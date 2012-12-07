var tileSize = 32,
    game = {
        buildables: [ def.mine, def.powerplant, def.turret, def.factory ],
        unitBuildables: [def.tank, def.heavyTank],
        tileSize: 32,
        difficulty: 1,
        root: ns.Node(),
        count: 0,
        frames: 0,
        selectedUnits: ns.Node(),
        mousePosition: {X: window.innerWidth / 2, Y: window.innerHeight / 2},
        units: ns.Node(),
        enemy: ns.Node(),
        fps: 0,
        playerCount: 0,
        players: [],
        buildMode: null,
        collisionMap: [],
        map: [],
        energy: 0,
        energyWarning: 0,
        colors: [
            "#3A3",
            "#A3A",
            "#AA3",
            "#33A",
            "#A33",
            "#3AA"
        ],
        positions: [
            {X: 10, Y: 10},
            {X: 10, Y: 118},
            {X: 118, Y: 118},
            {X: 118, Y: 10}
        ],
        EASY: 0,
        MEDIUM: 1,
        HARD: 2
    }, collision = {
        PASSABLE: 0,
        UNPASSABLE: 1,
        UNIT: 2,
        STRUCTURE: 3,
        RESERVED: 4
    }, key = {
        Q: 81,
        W: 87,
        E: 69,
        R: 82,
        T: 84,
        ESC: 27,
        F1: 112
    };

game.centerOn = function(position) {
    console.log("center on " + position.X + ", " + position.Y);
    console.log("screen size " + game.map.screenSize.X + ", " + game.map.screenSize.Y);
    game.map.offset.X = position.X - game.map.screenSize.X / 2;
    game.map.offset.Y = position.Y - game.map.screenSize.Y / 2;
    if(game.map.offset.X + game.map.screenSize.X > game.map.width) {
        game.map.offset.X = game.map.width - game.map.screenSize.X - 1;
    }
    if(game.map.offset.Y + game.map.screenSize.Y > game.map.width) {
        game.map.offset.Y = game.map.height - game.map.screenSize.Y - 1;
    }
    if(game.map.offset.X - game.map.screenSize.X / 2 < 0) {
        game.map.offset.X = 0;
    }
    if(game.map.offset.Y - game.map.screenSize.Y / 2 < 0) {
        game.map.offset.Y = 0;
    }    
    console.log("actual offset " + game.map.offset.X + ", " + game.map.offset.Y);
    game.map.draw();
};

game.getPlayer = function(id) {
    for(var i = 0; i < game.players.length; i++) {
        if(game.players[i].id === id) return game.players[i];
    }
};

game.getUnit = function(id) {
    return game.units.find("id", id);
};

game.deselectAll = function() {
    game.selectedUnits.each(function() {
        this.deselect();
    });
    game.selectedUnits.clear();
};

game.sell = function(building) {
    network.request({
        type: "sell",
        id: building.id
    });
};

game.canvasInit = function() {
    game.canvas = document.getElementById("game");
    game.context = game.canvas.getContext("2d");
    game.canvas.width = window.innerWidth;
    game.canvas.height = window.innerHeight;   
    game.log = NetLog(game.context, 
        {
            top: 0,
            left: game.canvas.width - 400,
            width: 400,
            height: game.canvas.height
        }, {
            messageColor: "white",
            outline: false,
            shadow: true
        }
    );    
    game.hud = Hud(game.context);
    game.log.onMessage(function(msg) {
        network.chat(msg);
    });    
}

game.connect = function(server) {
    network.connect(server);
};

game.init = function(difficulty) {
    game.start = (new Date()).getTime();
    game.difficulty = difficulty;
    if(!game.canvas) {
        game.canvasInit();
    }
    game.hud.on("minimap", function(pos) {
        game.map.offset.X = pos.X & (127 - game.map.screenSize.X) | 0;
        game.map.offset.Y = pos.Y & (127 - game.map.screenSize.Y) | 0;      
        game.map.draw();
    });
    game.canvas.addEventListener("mousedown", function(e) {
        game.mouseDown = true;
        game.dragStart = {X: e.clientX, Y: e.clientY};
        if( ui.has(e.clientX, e.clientY) ) {
            game.uiDrag = {X: e.clientX - ui.hudPosition.X, Y: e.clientY - ui.hudPosition.Y };
        }            
    });
    game.canvas.addEventListener("mousemove", function(e) {
        game.mousePosition.X = e.clientX;
        game.mousePosition.Y = e.clientY;
        if(game.mouseDown) {
            var topLeft = {X: game.dragStart.X, Y: game.dragStart.Y };//.shallow(),
                w = Math.abs(e.clientX - game.dragStart.X),
                h = Math.abs(e.clientY - game.dragStart.Y);
            if(e.clientX < topLeft.X) {
                topLeft.X = e.clientX;
            }
            if(e.clientY < topLeft.Y) {
                topLeft.Y = e.clientY;
            }

            if(!game.uiDrag) {
                if(w < 0) { topLeft.X += w; w *= -1; }
                if(h < 0) { topLeft.Y += h; h *= -1; }
                game.selection = [topLeft.X, topLeft.Y,  w, h];
            } else {
                ui.alpha = 0.5;
                ui.hudPosition = {X: topLeft.X + w - game.uiDrag.X, Y: topLeft.Y + h - game.uiDrag.Y};
            }
        }
    });
    document.addEventListener("keydown", function(e) {
        if(game.log && game.log.inputMode) {
            return;
        }
        var nr = e.keyCode - 48;
        if(e.ctrlKey) {            
            e.preventDefault();
            if(nr > 0 && nr < 10 ) {
                game.units.each(function() {
                    if(this.team === nr) {
                        this.team = 0;
                    }
                });
                game.selectedUnits.each(function() {
                    this.team = nr;
                });
                return false;
            }
        } else {
            if(nr > 0 && nr < 10 ) {
                game.players[0].selectTeam(nr);
            }
        }
        var action = -1;
        switch(e.keyCode) {
            case key.Q:
                action = 0;
            break;
            case key.W:
                action = 1;
            break;
            case key.E:
                action = 2;
            break;
            case key.R:
                action = 3;
            break;
            case key.T:
                action = 4;
            break;
            case key.ESC:
                 game.deselectAll();
                 menu.hide('shortcuts');
            break;
            case key.F1:
                e.preventDefault();
                menu.show('shortcuts');
            break;
        }
        if(action !== -1 && ui.actionButtons[action]) {
            ui.actionButtons[action]();
        }

    });
    game.hud.buttons = game.hud.Buttons([{image: qdip.images.mine, action: function() {
        game.buildMode = def.mine;
    }}]);
    game.canvas.addEventListener("mouseup", function(e) {
        /* if(game.dragStart)
            game.dragStart.release(); */
        game.mouseDown = false;
        if( ui.has(e.clientX, e.clientY) ) {
            ui.click(e.clientX - ui.hudPosition.X, e.clientY - ui.hudPosition.Y);
        } else {
            if(game.buildMode) {
                if(e.button === 0) {
                    var buildable = game.buildMode,
                        pos = {X: ((e.clientX  - gameView.offset.X) / tileSize + game.map.offset.X) | 0, Y: (e.clientY / tileSize + game.map.offset.Y - gameView.offset.Y) | 0};
                    network.build(pos, buildable);
                }
                if(!e.shiftKey) {
                    game.buildMode = null;
                }
            } else {
                if(!game.uiDrag) {
                    if(bt.Vec.distance(game.dragStart, {X: e.clientX , Y: e.clientY }) < 32) {
                        var selected = false;
                        if(e.button === 0) {
                            game.units.each(function() {
                                if(this.click(e.clientX - gameView.offset.X, e.clientY - gameView.offset.Y)) {
                                    selected = true;
                                }
                            });
                            if(!selected) {
                                var p = game.map.at(e.clientX, e.clientY),
                                    destinations = game.spiral(game.selectedUnits.length, p);
                                game.selectedUnits.each(function() {
                                    this.targetUnit = null;
                                    this.go(destinations.shift());
                                });
                            }
                        } else {
                            game.deselectAll();
                        }
                    } else {
                        //select inside box
                        game.deselectAll();
                        game.units.each(function() {
                            if(this.isInside(game.selection) && this.owner.local && this.mobile) {
                                this.select();
                                game.selectedUnits.add(this);
                            }
                        });
                    }
                }
            }
        }
        game.uiDrag = false;
        ui.alpha = 1.0;
        
        game.selection = null;
        return false;
    });
    //gameView(800, 800);
    //gameView(window.innerWidth, window.innerHeight);
};


game.run = function() {
    game.frames++;
    for(var i = 0; i < game.players.length; i++) {
        game.players[i].update();
    }
    game.root.each(function() {
        this.draw();
    });
    if(game.selection) {
        game.context.fillStyle = "rgba(30, 210, 230, 0.5)";
        game.context.fillRect.apply(game.context, game.selection);
    }
    if(game.buildMode) {
        var color = "grey",
            pos = game.map.at(game.mousePosition.X, game.mousePosition.Y);
        if(!game.legalPosition(pos, game.buildMode) || game.buildMode.cost > game.players[0].credits) {
            color = "red";
        }
        game.buildMode.art(game.mousePosition.X - game.mousePosition.X % 32 , game.mousePosition.Y - game.mousePosition.Y % 32 , color, "black", 0, 0, true);
    }
    var now = (new Date()).getTime();
    if(game.players[0].energy < 0 && now - game.energyWarning > 10000) {
        if(game.log) {
            game.log.info("Low energy, buildings offline.");    
        }        
        game.energyWarning = now;
    }
    if(game.log && game.hud) {
        game.log.draw();
        game.hud.draw();
    }
    ui.draw();

    //ts.collisionDebug();
    setTimeout(game.run, 5);
};

game.unitAt = function(pos) {
    var unit = null;
    game.units.each(function(){
        //console.log(this.tile);
        //console.log(pos);
        if(this.tile.X === pos.X && this.tile.Y === pos.Y) {
            unit = this;
        }
    });
    return unit;
};

game.spiral = function(n, p, spec) {
    var x = 0,
    y = 0,
    dx = 0,
    dy = -1,
    t,
    positions = [];

    while(positions.length < n) {
        if( (x == y) || ((x < 0) && (x == -y)) || ((x > 0) && (x == 1-y))) {
            t = dx;
            dx = -dy;
            dy = t;
        }
        if(spec) {
            if(game.legalPosition({X: p.X + x, Y: p.Y + y}, spec)) {//game.collisionMap[p.X + x] && game.collisionMap[p.X + x][p.Y + y] === collision.PASSABLE) {
                positions.push({X: p.X + x, Y: p.Y + y});
            }            
        } else {
            if(game.collisionMap[p.X + x] && game.collisionMap[p.X + x][p.Y + y] === collision.PASSABLE) {
                positions.push({X: p.X + x, Y: p.Y + y});
            }
        }        
        x += dx;
        y += dy;
    }
    return positions;
};

game.legalPosition = function(position, spec) {
    if(typeof(spec.terrain) === 'number') {
        var proximity = false;
        game.units.each(function() {
            if(this.spec == spec && bt.Vec.distance(this.tile, position) < 6) {
                proximity = true;
            }
        });
        if(proximity) return false;
        return  (game.map.map[position.X] && game.map.map[position.X][position.Y] === spec.terrain &&
                (game.collisionMap[position.X][position.Y] !== collision.UNIT || collision.STRUCTURE));
    }    
    if(spec.big) {
        return (game.map.map[position.X] &&
                game.map.map[position.X][position.Y] !== 0 &&
                game.map.map[position.X + 1][position.Y] !== 0 &&
                game.map.map[position.X][position.Y + 1] !== 0 &&
                game.map.map[position.X + 1][position.Y + 1] !== 0 &&
                game.collisionMap[position.X][position.Y] === collision.PASSABLE &&
                game.collisionMap[position.X + 1][position.Y] === collision.PASSABLE &&
                game.collisionMap[position.X][position.Y + 1] === collision.PASSABLE &&
                game.collisionMap[position.X + 1][position.Y + 1] === collision.PASSABLE);
    }
    return (game.map.map[position.X] && game.map.map[position.X][position.Y] !== 0 &&
            game.collisionMap[position.X][position.Y] === collision.PASSABLE);
};
