Hooks.once('init', () => {
    game.settings.register('spelljammer-shop', 'shopScenes', {
        name: 'Shop Scene Mappings',
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });
});

class SpelljammerShopLayer extends CanvasLayer {
    constructor() {
        super();
        this.shopIcons = new PIXI.Container();
        this.addChild(this.shopIcons);
    }

    async draw() {
        this.shopIcons.removeChildren();
        const shops = canvas.tokens.placeables.filter(token => 
            token.document.getFlag('spelljammer-shop', 'isShop'));
        
        for (let shop of shops) {
            const icon = await this._createShopIcon(shop);
            this.shopIcons.addChild(icon);
        }
        return this;
    }

    async _createShopIcon(shop) {
        const sprite = new PIXI.Sprite.from('modules/spelljammer-shop/icons/shop.png');
        sprite.position.set(shop.x, shop.y);
        sprite.width = shop.width;
        sprite.height = shop.height;
        sprite.interactive = true;
        sprite.buttonMode = true;
        
        sprite.on('click', async () => {
            const shopData = shop.document.getFlag('spelljammer-shop', 'shopData');
            if (!shopData) return;

            new Dialog({
                title: shop.name,
                content: this._getShopContentHTML(shopData),
                buttons: {
                    items: {
                        label: "General Items",
                        callback: () => this._showInventory(shopData, 'general')
                    },
                    services: {
                        label: "Services",
                        callback: () => this._showServices(shopData)
                    }
                }
            }).render(true);
        });
        
        return sprite;
    }

    _getShopContentHTML(shopData) {
        return `
            <div class="shop-info">
                <div>Type: ${shopData.type || 'General Store'}</div>
                <div>Location: ${shopData.location || 'Unknown'}</div>
                <div>Currency: ${this._formatCurrency(shopData.currency)}</div>
                <div>Services: ${shopData.services?.map(s => s.name).join(', ') || 'None'}</div>
            </div>
        `;
    }

    async _showServices(shopData) {
        const services = shopData.services || [];
        new Dialog({
            title: "Available Services",
            content: `
                <div class="services-list">
                    <table>
                        <tr>
                            <th>Service</th>
                            <th>Cost</th>
                            <th>Description</th>
                            <th>Actions</th>
                        </tr>
                        ${services.map(service => `
                            <tr>
                                <td>${service.name}</td>
                                <td>${this._formatCurrency({gp: service.cost})}</td>
                                <td>${service.description || ''}</td>
                                <td>
                                    <button class="purchase-service" data-service="${service.type}">
                                        Purchase
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `,
            buttons: { close: { label: "Close" } }
        }).render(true);
    }

    _formatCurrency(currency) {
        if (!currency) return '0 gp';
        return Object.entries(currency)
            .filter(([_, amount]) => amount > 0)
            .map(([type, amount]) => `${amount} ${type}`)
            .join(', ');
    }
}

Hooks.on('canvasInit', () => {
    const canvas = game.canvas;
    canvas.spelljammerShop = canvas.addLayer(new SpelljammerShopLayer());
});

Hooks.on('getSceneControlButtons', (controls) => {
    controls.find(c => c.name === "tokens")?.tools.push({
        name: "configureSpelljammerShop",
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
                title: "Configure Spelljammer Shop",
                content: `
                    <div class="form-group">
                        <label>Shop Type:</label>
                        <select id="shop-type">
                            <option value="general">General Store</option>
                            <option value="shipwright">Shipwright</option>
                            <option value="components">Ship Components</option>
                            <option value="tavern">Tavern</option>
                            <option value="blacksmith">Blacksmith</option>
                            <option value="gunsmith">Gunsmith</option>
                            <option value="arcane">Arcane Shop</option>
                            <option value="potions">Potion Shop</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Location:</label>
                        <input type="text" id="shop-location">
                    </div>
                    <div class="form-group services-config">
                        <label>Available Services:</label>
                        <div class="service-list">
                            <!-- Ship Services -->
                            <div class="service-entry ship-service">
                                <input type="checkbox" id="service-repairs" value="repairs">
                                <label for="service-repairs">Ship Repairs</label>
                                <input type="number" class="service-cost" data-service="repairs" value="100">
                                <span>gp</span>
                            </div>
                            <div class="service-entry ship-service">
                                <input type="checkbox" id="service-helm" value="helm">
                                <label for="service-helm">Helm Installation</label>
                                <input type="number" class="service-cost" data-service="helm" value="500">
                                <span>gp</span>
                            </div>
                            
                            <!-- Crew Services -->
                            <div class="service-entry crew-service">
                                <input type="checkbox" id="service-crew" value="crew">
                                <label for="service-crew">Crew Hiring</label>
                                <input type="number" class="service-cost" data-service="crew" value="2">
                                <span>gp/day</span>
                            </div>
                            
                            <!-- Equipment Services -->
                            <div class="service-entry equipment-service">
                                <input type="checkbox" id="service-weapon-repair" value="weapon-repair">
                                <label for="service-weapon-repair">Weapon Repair</label>
                                <input type="number" class="service-cost" data-service="weapon-repair" value="10">
                                <span>gp</span>
                            </div>
                            <div class="service-entry equipment-service">
                                <input type="checkbox" id="service-armor-repair" value="armor-repair">
                                <label for="service-armor-repair">Armor Repair</label>
                                <input type="number" class="service-cost" data-service="armor-repair" value="15">
                                <span>gp</span>
                            </div>
                            
                            <!-- Gunsmith Services -->
                            <div class="service-entry gunsmith-service">
                                <input type="checkbox" id="service-firearm-repair" value="firearm-repair">
                                <label for="service-firearm-repair">Firearm Repair</label>
                                <input type="number" class="service-cost" data-service="firearm-repair" value="25">
                                <span>gp</span>
                            </div>
                            <div class="service-entry gunsmith-service">
                                <input type="checkbox" id="service-ammo-crafting" value="ammo-crafting">
                                <label for="service-ammo-crafting">Ammunition Crafting</label>
                                <input type="number" class="service-cost" data-service="ammo-crafting" value="5">
                                <span>gp</span>
                            </div>
                            
                            <!-- Arcane Services -->
                            <div class="service-entry arcane-service">
                                <input type="checkbox" id="service-identify" value="identify">
                                <label for="service-identify">Identify Item</label>
                                <input type="number" class="service-cost" data-service="identify" value="100">
                                <span>gp</span>
                            </div>
                            <div class="service-entry arcane-service">
                                <input type="checkbox" id="service-enchant" value="enchant">
                                <label for="service-enchant">Enchanting Service</label>
                                <input type="number" class="service-cost" data-service="enchant" value="500">
                                <span>gp</span>
                            </div>
                            
                            <!-- Potion Services -->
                            <div class="service-entry potion-service">
                                <input type="checkbox" id="service-brew" value="brew">
                                <label for="service-brew">Custom Potion Brewing</label>
                                <input type="number" class="service-cost" data-service="brew" value="50">
                                <span>gp</span>
                            </div>
                            <div class="service-entry potion-service">
                                <input type="checkbox" id="service-analyze" value="analyze">
                                <label for="service-analyze">Potion Analysis</label>
                                <input type="number" class="service-cost" data-service="analyze" value="25">
                                <span>gp</span>
                            </div>
                            
                            <button type="button" id="add-custom-service">+ Add Custom Service</button>
                        </div>
                    </div>
                `,
                buttons: {
                    save: {
                        label: "Save Configuration",
                        callback: async (html) => {
                            const services = [];
                            html.find('.service-entry').each((i, el) => {
                                const $el = $(el);
                                if ($el.find('input[type="checkbox"]').prop('checked')) {
                                    services.push({
                                        name: $el.find('label').text(),
                                        type: $el.find('input[type="checkbox"]').val(),
                                        cost: parseInt($el.find('.service-cost').val())
                                    });
                                }
                            });
                            
                            await token.document.setFlag('spelljammer-shop', 'isShop', true);
                            await token.document.setFlag('spelljammer-shop', 'shopData', {
                                type: html.find('#shop-type').val(),
                                location: html.find('#shop-location').val(),
                                services
                            });
                            
                            canvas.spelljammerShop.draw();
                        }
                    }
                },
                render: (html) => {
                    // Add shop type change handler
                    html.find('#shop-type').change(event => {
                        const type = event.currentTarget.value;
                        const serviceChecks = html.find('.service-list input[type="checkbox"]');
                        
                        // Reset all
                        serviceChecks.prop('checked', false);
                        
                        // Hide all service categories
                        html.find('.ship-service, .crew-service, .equipment-service, .gunsmith-service, .arcane-service, .potion-service')
                            .hide();
                        
                        // Show and set defaults based on type
                        switch(type) {
                            case 'shipwright':
                                html.find('.ship-service').show();
                                html.find('#service-repairs, #service-helm').prop('checked', true);
                                break;
                            case 'components':
                                html.find('.ship-service').show();
                                break;
                            case 'tavern':
                                html.find('.crew-service').show();
                                html.find('#service-crew').prop('checked', true);
                                break;
                            case 'blacksmith':
                                html.find('.equipment-service').show();
                                html.find('#service-weapon-repair, #service-armor-repair').prop('checked', true);
                                break;
                            case 'gunsmith':
                                html.find('.gunsmith-service').show();
                                html.find('#service-firearm-repair, #service-ammo-crafting').prop('checked', true);
                                break;
                            case 'arcane':
                                html.find('.arcane-service').show();
                                html.find('#service-identify, #service-enchant').prop('checked', true);
                                break;
                            case 'potions':
                                html.find('.potion-service').show();
                                html.find('#service-brew, #service-analyze').prop('checked', true);
                                break;
                            case 'general':
                                html.find('.equipment-service').show();
                                break;
                            case 'custom':
                                html.find('.ship-service, .crew-service, .equipment-service, .gunsmith-service, .arcane-service, .potion-service')
                                    .show();
                                break;
                        }
                    });

                    // Add custom service handler
                    html.find('#add-custom-service').click(() => {
                        const serviceList = html.find('.service-list');
                        const newService = $(`
                            <div class="service-entry custom">
                                <input type="checkbox" checked>
                                <input type="text" class="service-name" placeholder="Service Name">
                                <input type="number" class="service-cost" value="0">
                                <span>gp</span>
                                <button type="button" class="remove-service">×</button>
                            </div>
                        `);
                        serviceList.append(newService);
                    });
                }
            }).render(true);
        }
    });
});