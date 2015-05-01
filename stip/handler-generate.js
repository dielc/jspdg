'use strict';

var handlerGenerate = (function () {
	var module = {};

	var makeLeafName = function (name) {
		return name + 'Leaf';
	};

	var makeProxyName = function (name) {
		return name + 'Proxy';
	};

	var handlerProxySetup = function () {
		return esprima.parse('var fp = makeFailureProxy(client, adapter);').body[0];
	};

	var handlerProxyDefinition = function (name, handler) {
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
					'arguments': [ {
						'type': 'Identifier',
						'name': handler
					}]
				}
			}],
			'kind': 'var'
		}
	};

	var handlerState = {}; // building state for leaves
	var makeHandlerNode = function (current) {
		var handlerName = current.handler,
			uniqueName = current.uniqueName,
			leafName   = current.leafName,
			parent     = current.parent,
			priority   = current.priority,
			rpcCount   = current.rpcCount;

		if (parent === uniqueName) { //top node
			parent = undefined;
		}

		var handlerDef = Handler.defined[handlerName];

		if (!handlerDef) {
			console.log('Warning: Handler definition \'' + handlerName + '\' not found.');
			handlerDef = Handler.defined._noOpHandler; //use the predefined no-operation handler
		}

		handlerState[uniqueName] = handlerDef.constructorBody;
		if (handlerState[parent]) //also take the parent' state
			handlerState[uniqueName] = handlerState[uniqueName].concat(handlerState[parent].slice());

		var generatedhandlers = [];
		//make handler
		generatedhandlers.push(handlerDef.make(uniqueName, parent, priority, handlerDef.handlerMethods, []));

		if (rpcCount > 0) //make its corresponding leaf
			generatedhandlers.push(handlerDef.make(leafName, uniqueName, false, [], handlerState[uniqueName]));

		return generatedhandlers;
	};


	module.handlerProxySetup      = handlerProxySetup;
	module.handlerProxyDefinition = handlerProxyDefinition;
	module.makeLeafName           = makeLeafName;
	module.makeProxyName          = makeProxyName;
	module.makeHandlerNode        = makeHandlerNode;

	return module;
});