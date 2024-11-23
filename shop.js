// Register module settings
Hooks.once('init', () => {
    game.settings.register('spelljammer-shops', 'shopScenes', {
        name: 'Shop Scene Mappings',
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });
    
    game.settings.register('spelljammer-shops', 'lastTownScene', {
        name: 'Last Town Scene',
        scope: 'world',
        config: false,
        type: String,
        default: ""
    });

    game.settings.register('spelljammer-shops', 'lastShopEntrance', {
        name: 'Last Shop Entrance',
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });
});

// Add Configure Shop button to token controls
Hooks.on('getSceneControlButtons', (controls) => {
    controls.find(c => c.name === "token")?.tools.push({
        name: "linkShop",
        title: "Configure Shop",
        icon: "fas fa-store",
        visible: game.user.isGM,
        onClick: () => {
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
                        }
                    }
                }
            }).render(true);
        }
    });
});

// Handle shop token clicks
Hooks.on('ready', () => {
    // Set up token click listener
    Hooks.on('controlToken', async (token) => {
        if (!token.document?.getFlag('spelljammer-shops', 'isShop')) return;
        
        const linkedSceneId = token.document.getFlag('spelljammer-shops', 'linkedScene');
        const scene = game.scenes.get(linkedSceneId);
        
        if (!scene) return;
        
        // Store current scene as town scene
        await game.settings.set('spelljammer-shops', 'lastTownScene', canvas.scene.id);
        
        // Store entrance position
        const entrancePos = token.document.getFlag('spelljammer-shops', 'entrancePosition');
        await game.settings.set('spelljammer-shops', 'lastShopEntrance', entrancePos);
        
        // View the shop scene
        await scene.view();
        
        // Teleport players to entrance
        if (entrancePos) {
            for (let playerToken of canvas.tokens.controlled) {
                await playerToken.document.update({
                    x: entrancePos.x,
                    y: entrancePos.y
                });
            }
        }
        
        // Spawn merchant if needed
        const merchantPos = token.document.getFlag('spelljammer-shops', 'merchantPosition');
        const merchantData = token.document.getFlag('spelljammer-shops', 'merchantData');
        
        if (merchantPos && merchantData) {
            await scene.createEmbeddedDocuments('Token', [{
                ...merchantData,
                x: merchantPos.x,
                y: merchantPos.y,
                flags: {
                    'spelljammer-shops': {
                        isMerchant: true
                    }
                }
            }]);
        }
    });
});

// Add double-click handling for additional reliability
Hooks.on('ready', () => {
    Hooks.on('clickToken', async (token) => {
        if (!token.document?.getFlag('spelljammer-shops', 'isShop')) return;
        
        const linkedSceneId = token.document.getFlag('spelljammer-shops', 'linkedScene');
        const scene = game.scenes.get(linkedSceneId);
        
        if (!scene) return;
        
        // Store current scene as town scene
        await game.settings.set('spelljammer-shops', 'lastTownScene', canvas.scene.id);
        
        // Store entrance position
        const entrancePos = token.document.getFlag('spelljammer-shops', 'entrancePosition');
        await game.settings.set('spelljammer-shops', 'lastShopEntrance', entrancePos);
        
        // View the shop scene
        await scene.view();
        
        // Teleport players to entrance
        if (entrancePos) {
            for (let playerToken of canvas.tokens.controlled) {
                await playerToken.document.update({
                    x: entrancePos.x,
                    y: entrancePos.y
                });
            }
        }
    });
});

// Add Return to Town button
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

// Add visual feedback for shop tokens
Hooks.on('renderToken', (app, html, data) => {
    if (app.document?.getFlag('spelljammer-shops', 'isShop')) {
        html.addClass('shop-token');
    }
});

// Add CSS
Hooks.once('ready', () => {
    const style = document.createElement('style');
    style.textContent = `
        .shop-token {
            cursor: pointer;
        }
        .shop-token:hover {
            box-shadow: 0 0 10px #ff6400;
        }
        .shop-token.active {
            box-shadow: 0 0 20px #ff6400;
        }
    `;
    document.head.appendChild(style);
});