'use strict';

var handlerGenerate = (function() {

    var module = {};

    var handlerProxySetup = function() {
        return esprima.parse('var fp = makeFailureProxy(client);').body[0];
    };

    var handlerProxyDefinition = function(name, handler) {
        return {
            'type': 'VariableDeclaration',
            'declarations': [{
                'type': 'VariableDeclarator',
                'id': {
                    'type': 'Identifier',
                    'name': name
                },
                'init': {
                    'type': 'CallExpression',
                    'callee': {
                        'type': 'Identifier',
                        'name': 'fp'
                    },
                    'arguments': [{
                        'type': 'Identifier',
                        'name': handler
                    }]
                }
            }],
            'kind': 'var'
        }
    };

    var handlerState = {}; // building state for leaves

    var makeHandlerNode = function(current) {
        var handlerName = current.handler,
            uniqueName = current.uniqueName,
            leafName   = current.leafName,
            parent     = current.parent,
            priority   = current.priority,
            rpcCount   = current.rpcCount;

        if (parent === uniqueName) { //top node
            parent = undefined;
        }

        var handlerDefinition = Handler.defined[handlerName];

        if (!handlerDefinition) {
            console.log('Warning: Handler definition \'' + handlerName + '\' not found.');
            handlerDefinition = Handler.defined._noOpHandler; //use the predefined no-operation handler
        }

        var handlerMethods = handlerDefinition.handlerMethods();
        //make sure the new state identifiers have correct name
        handlerState[uniqueName] = handlerDefinition.constructorBody(uniqueName);

        if (handlerState[parent]) //also take the parent' state
            handlerState[uniqueName] = handlerState[uniqueName].concat(handlerState[parent].slice());

        var generatedhandlers = [];
        //make handler
        generatedhandlers.push(handlerDefinition.newHandler(uniqueName, parent, priority, handlerMethods, []));

        if (rpcCount > 0) //make its corresponding leaf
            generatedhandlers.push(handlerDefinition.newHandler(leafName, uniqueName, false, [], handlerState[uniqueName]));

        return generatedhandlers;
    };

    var init = function() {
        handlerState = {};
    };

    module.proxySetup      = handlerProxySetup;
    module.proxyDefinition = handlerProxyDefinition;
    module.handlerNode     = makeHandlerNode;
    module.init            = init;

    return module;
});