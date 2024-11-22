Hooks.once('init', () => {
    game.settings.register('spelljammer-shops', 'shopScenes', {
        name: 'Shop Scene Mappings',
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });
});

class ShopLayer extends CanvasLayer {
    constructor() {
        super();
        this.shopIcons = new PIXI.Container();
        this.addChild(this.shopIcons);
    }

    async draw() {
        this.shopIcons.removeChildren();
        const shopScenes = game.settings.get('spelljammer-shops', 'shopScenes');
        
        const shops = canvas.tokens.placeables.filter(token => 
            token.document.getFlag('spelljammer-shops', 'isShop'));
        
        for (let shop of shops) {
            const icon = await this._createShopIcon(shop);
            this.shopIcons.addChild(icon);
        }
        
        return this;
    }

    async _createShopIcon(shop) {
        const sprite = new PIXI.Sprite.from('modules/spelljammer-shops/icons/shop.png');
        sprite.position.set(shop.x, shop.y);
        sprite.width = shop.width;
        sprite.height = shop.height;
        sprite.interactive = true;
        sprite.buttonMode = true;
        
        sprite.on('click', async () => {
            const linkedSceneId = shop.document.getFlag('spelljammer-shops', 'linkedScene');
            if (linkedSceneId) {
                const scene = game.scenes.get(linkedSceneId);
                if (scene) {
                    await game.settings.set('spelljammer-shops', 'lastTownScene', canvas.scene.id);
                    
                    await game.settings.set('spelljammer-shops', 'lastShopEntrance', 
                        shop.document.getFlag('spelljammer-shops', 'entrancePosition'));
                    
                    await scene.view();
                    
                    const entrancePos = shop.document.getFlag('spelljammer-shops', 'entrancePosition');
                    if (entrancePos) {
                        await this._teleportPlayersToEntrance(entrancePos);
                    }
                    
                    const merchantPos = shop.document.getFlag('spelljammer-shops', 'merchantPosition');
                    if (merchantPos) {
                        await this._spawnMerchantToken(scene, merchantPos, shop);
                    }
                }
            }
        });
        
        return sprite;
    }

    async _teleportPlayersToEntrance(entrancePos) {
        for (let token of canvas.tokens.controlled) {
            await token.document.update({
                x: entrancePos.x,
                y: entrancePos.y
            });
        }
    }

    async _spawnMerchantToken(scene, position, shopToken) {
        const existingMerchant = scene.tokens.find(t => 
            t.getFlag('spelljammer-shops', 'isMerchant'));
        
        if (!existingMerchant) {
            const merchantData = shopToken.document.getFlag('spelljammer-shops', 'merchantData');
            if (merchantData) {
                await scene.createEmbeddedDocuments('Token', [{
                    ...merchantData,
                    x: position.x,
                    y: position.y,
                    flags: {
                        'spelljammer-shops': {
                            isMerchant: true
                        }
                    }
                }]);
            }
        }
    }
}

Hooks.on('canvasInit', () => {
    const canvas = game.canvas;
    canvas.shops = canvas.addLayer(new ShopLayer());
});

Hooks.on('getSceneControlButtons', (controls) => {
    console.log("Shop module hook running", controls);
    controls.find(c => c.name === "tokens")?.tools.push({
        name: "linkShop",
        title: "Configure Shop",
        icon: "fas fa-store",
        visible: game.user.isGM,
        onClick: () => {
            const token = canvas.tokens.controlled[0];
            if (!token) {
                ui.notifications.error("Please select a token first");
                return;
            }
            
            new Dialog({
                title: "Configure Shop",
                content: `
                    <div class="form-group">
                        <label>Select Shop Interior Scene:</label>
                        <select id="scene-select">
                            ${game.scenes.map(scene => 
                                `<option value="${scene.id}">${scene.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Merchant Position:</label>
                        <div>
                            <label>X: <input type="number" id="merchant-x" value="0"/></label>
                            <label>Y: <input type="number" id="merchant-y" value="0"/></label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Shop Entrance Position:</label>
                        <div>
                            <label>X: <input type="number" id="entrance-x" value="0"/></label>
                            <label>Y: <input type="number" id="entrance-y" value="0"/></label>
                        </div>
                    </div>
                `,
                buttons: {
                    link: {
                        label: "Save Configuration",
                        callback: async (html) => {
                            const selectedToken = canvas.tokens.controlled[0];
                            if (!selectedToken) {
                                ui.notifications.error("Please select a token first");
                                return;
                            }
                            
                            const sceneId = html.find('#scene-select').val();
                            const merchantX = Number(html.find('#merchant-x').val());
                            const merchantY = Number(html.find('#merchant-y').val());
                            const entranceX = Number(html.find('#entrance-x').val());
                            const entranceY = Number(html.find('#entrance-y').val());
                            
                            await selectedToken.document.setFlag('spelljammer-shops', 'isShop', true);
                            await selectedToken.document.setFlag('spelljammer-shops', 'linkedScene', sceneId);
                            await selectedToken.document.setFlag('spelljammer-shops', 'merchantPosition', {
                                x: merchantX,
                                y: merchantY
                            });
                            await selectedToken.document.setFlag('spelljammer-shops', 'entrancePosition', {
                                x: entranceX,
                                y: entranceY
                            });
                            
                            await selectedToken.document.setFlag('spelljammer-shops', 'merchantData', {
                                name: `${selectedToken.name}'s Merchant`,
                                img: 'icons/svg/mystery-man.svg',
                                width: 1,
                                height: 1
                            });
                            
                            canvas.shops.draw();
                        }
                    }
                }
            }).render(true);
        }
    });
});

Hooks.on('renderSceneNavigation', (app, html) => {
    const townSceneId = game.settings.get('spelljammer-shops', 'lastTownScene');
    if (townSceneId && canvas.scene.id !== townSceneId) {
        const button = $(`
            <li class="scene-control" title="Return to Town">
                <i class="fas fa-map"></i>
            </li>
        `);
        button.click(async () => {
            const scene = game.scenes.get(townSceneId);
            const lastEntrance = game.settings.get('spelljammer-shops', 'lastShopEntrance');
            if (scene) {
                await scene.view();
                if (lastEntrance) {
                    for (let token of canvas.tokens.controlled) {
                        await token.document.update({
                            x: lastEntrance.x,
                            y: lastEntrance.y
                        });
                    }
                }
            }
        });
        html.append(button);
    }
});