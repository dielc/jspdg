'use strict';

var handlerTransform = (function () {

	var module = {};


	var createBlockStatement = function (body) {
		return {
			type: 'BlockStatement',
			body: body
		}
	};

	var createField = function (fieldName, rhs) {
		return {
			'type': 'ExpressionStatement',
			'expression': {
				'type': 'AssignmentExpression',
				'operator': '=',
				'left': {
					'type': 'MemberExpression',
					'computed': false,
					'object': {
						'type': 'ThisExpression'
					},
					'property': {
						'type': 'Identifier',
						'name': fieldName
					}
				},
				'right': rhs
			}
		}
	};

	var createMethod = function (methodName, functionExpressionNode) {
		return function (objectName) {
			return {
				'type': 'ExpressionStatement',
				'expression': {
					'type': 'AssignmentExpression',
					'operator': '=',
					'left': {
						'type': 'MemberExpression',
						'computed': false,
						'object': {
							'type': 'Identifier',
							'name': objectName
						},
						'property': {
							'type': 'Identifier',
							'name': methodName
						}
					},
					'right': functionExpressionNode
				}
			};
		}
	};

	var createConstructor = function (constructorName, bodyNode) {
		return {
			'type': 'VariableDeclaration',
			'declarations': [{
				'type': 'VariableDeclarator',
				'id': {
					'type': 'Identifier',
					'name': constructorName
				},
				'init': {
					'type': 'FunctionExpression',
					'id': null,
					'params': [],
					'defaults': [],
					'body': {
						'type': 'BlockStatement',
						'body': bodyNode
					},
					'generator': false,
					'expression': false
				}
			}],
			'kind': 'var'
		}
	};

	var createSuperMethod = function (objectName, parentNodeName) {
		return {
			'type': 'ExpressionStatement',
			'expression': {
				'type': 'AssignmentExpression',
				'operator': '=',
				'left': {
					'type': 'MemberExpression',
					'computed': false,
					'object': {
						'type': 'Identifier',
						'name': objectName
					},
					'property': {
						'type': 'Identifier',
						'name': 'super'
					}
				},
				'right': {
					'type': 'FunctionExpression',
					'id': null,
					'params': [{
						'type': 'Identifier',
						'name': 'target'
					}],
					'defaults': [],
					'body': {
						'type': 'BlockStatement',
						'body': [{
							'type': 'ExpressionStatement',
							'expression': {
								'type': 'CallExpression',
								'callee': {
									'type': 'MemberExpression',
									'computed': false,
									'object': {
										'type': 'Identifier',
										'name': 'target'
									},
									'property': {
										'type': 'Identifier',
										'name': 'handleException'
									}
								},
								'arguments': [{
									'type': 'Identifier',
									'name': parentNodeName
								}]
							}
						}]
					},
					'generator': false,
					'expression': false
				}
			}
		}
	};

	var createPriorityMethod = function (objectName, hasPriority) {
		return {
			'type': 'ExpressionStatement',
			'expression': {
				'type': 'AssignmentExpression',
				'operator': '=',
				'left': {
					'type': 'MemberExpression',
					'computed': false,
					'object': {
						'type': 'Identifier',
						'name': objectName
					},
					'property': {
						'type': 'Identifier',
						'name': 'flagPriority'
					}
				},
				'right': {
					'type': 'Literal',
					'value': hasPriority,
					'raw': hasPriority.toString()
				}
			}
		}
	};

	var createSetPrototype = function (objectName) {
		return {
			'type': 'ExpressionStatement',
			'expression': {
				'type': 'AssignmentExpression',
				'operator': '=',
				'left': {
					'type': 'MemberExpression',
					'computed': false,
					'object': {
						'type': 'Identifier',
						'name': objectName
					},
					'property': {
						'type': 'Identifier',
						'name': 'prototype'
					}
				},
				'right': {
					'type': 'NewExpression',
					'callee': {
						'type': 'Identifier',
						'name': 'HandlerNode'
					},
					'arguments': []
				}
			}
		}
	};

	var createSetConstructor = function (objectName) {
		return {
			'type': 'ExpressionStatement',
			'expression': {
				'type': 'AssignmentExpression',
				'operator': '=',
				'left': {
					'type': 'MemberExpression',
					'computed': false,
					'object': {
						'type': 'MemberExpression',
						'computed': false,
						'object': {
							'type': 'Identifier',
							'name': objectName
						},
						'property': {
							'type': 'Identifier',
							'name': 'prototype'
						}
					},
					'property': {
						'type': 'Identifier',
						'name': 'constructor'
					}
				},
				'right': {
					'type': 'Identifier',
					'name': objectName
				}
			}
		}
	};

	var createToStringMethod = function (objectName) {
		return {
			'type': 'ExpressionStatement',
			'expression': {
				'type': 'AssignmentExpression',
				'operator': '=',
				'left': {
					'type': 'MemberExpression',
					'computed': false,
					'object': {
						'type': 'MemberExpression',
						'computed': false,
						'object': {
							'type': 'Identifier',
							'name': objectName
						},
						'property': {
							'type': 'Identifier',
							'name': 'prototype'
						}
					},
					'property': {
						'type': 'Identifier',
						'name': 'toString'
					}
				},
				'right': {
					'type': 'FunctionExpression',
					'id': null,
					'params': [],
					'defaults': [],
					'body': {
						'type': 'BlockStatement',
						'body': [{
							'type': 'ReturnStatement',
							'argument': {
								'type': 'Literal',
								'value': ' -' + objectName,
								'raw': ' - ' + objectName
							}
						}]
					},
					'generator': false,
					'expression': false
				}
			}
		}
	};

	var createHandlerMaker = function (handlerMethods, constructorBody) {
		return {
			handlerMethods:  handlerMethods,
			constructorBody: constructorBody,
			//keep the current handler info accessible as annotations in code will decide where
			//constructorBody and the methods will end up.
			make: function (handlerName, parentNodeName, hasPriority, methods, body) {
				var handler = [];

				methods = methods || this.handlerMethods;
				body    = body || this.constructorBody;

				handler.push(createConstructor(handlerName, body));
				if(parentNodeName) 
					handler.push(createSuperMethod(handlerName, parentNodeName));
				handler.push(createPriorityMethod(handlerName, hasPriority));
				handler.push(createSetPrototype(handlerName));
				handler.push(createSetConstructor(handlerName));
				handler.push(createToStringMethod(handlerName));

				methods.map(function (method) {
					handler.push(method(handlerName));
				});

				return createBlockStatement(handler);
			}
		}
	};

	var isSpecialHandlerProperty = function (node) {
		return Handler.handlerMethods.indexOf(node.key.name) != -1;
	};

	var extractHandlerObject = function (node) {
		var name            = node.id.name;
		var methods         = [];
		var constructorBody = [];
		var renames         = {};

		estraverse.replace(node, {
			enter: function (node, parent) {

				//replace first arg of special handler methods by field access.
				if (esp_isProperty(node) && esp_isIdentifier(node.key) && isSpecialHandlerProperty(node)) {
					if (node.value.params.length && esp_isIdentifier(node.value.params[0])) { //first arg
						var argName = node.value.params[0].name;
						node.value.params = [];

						//only in the body of the method
						var body = node.value.body;
						estraverse.replace(body, {
							enter: function (node, parent) {
								if (esp_isIdentifier(node) && node.name === argName)
									return {
										'type': 'MemberExpression',
										'computed': false,
										'object': {
											'type': 'ThisExpression'
										},
										'property': {
											'type': 'Identifier',
											'name': Handler.handlerContext
										}
									};
							}
						});
					}
				}

				//Rename: var obj = {field:...} -> var obj = {objfield:...}
				if (esp_isProperty(node) && esp_isIdentifier(node.key)) {
					if (esp_isFunExp(node.value) && isSpecialHandlerProperty(node))
						return;

					var fieldToRename      = node.key.name;
					var newName            = name + fieldToRename;
					node.key.name          = newName;
					renames[fieldToRename] = newName;
				}
			}
		});

		//Rename all field accesses (this.field)
		estraverse.replace(node, {
			enter: function (node) {
				if (esp_isMemberExpression(node) && esp_isThisExpression(node.object) && esp_isIdentifier(node.property)) {
					var identifierName = node.property.name;

					if (renames[identifierName])
						node.property.name = renames[identifierName];
				}
			}
		});

		//Transform object properties.
		estraverse.traverse(node, {
			enter: function (node) {
				if (esp_isProperty(node) && esp_isIdentifier(node.key)) {
					var methodName = node.key.name;

					//only special handler methods will stay
					if (esp_isFunExp(node.value) && isSpecialHandlerProperty(node)) {
						methods.push(createMethod(methodName, node.value));
					} else {
						//other methods and fields, will become fields in constructor
						constructorBody.push(createField(methodName, node.value));
					}
				}
			}
		});

		return {
			name: name,
			handlerMaker: createHandlerMaker(methods, constructorBody)
		}
	};


	var extractUseHandlerAnnotation = function(lastParent, comment){
		var regexp = Handler.handlerUseRegExp;
		var annotations = [];

		if (comment.search(regexp) >= 0) {
			var match = regexp.exec(comment);
			while (match != null) {
				Handler.handlerCtr++;
				var m = match[1];
				var priority = false;
				if (m.substr(0, 1) === Handler.prioritySign) {
					priority = true;
					m = m.substr(1, m.length);
				}

				var currentName = m + Handler.handlerCtr;

				var annotationInfo = {
					parent: currentName,
					uniqueName: currentName,
					handler: m,
					rpcCount: 0,
					priority: priority,
					leafName: Handler.Generate.makeLeafName(currentName)
				}

				if (lastParent) {
					//last one added is our parent
					annotationInfo.parent = lastParent.uniqueName;
				}

				annotations.push(annotationInfo);
				lastParent = annotationInfo;
				match = regexp.exec(comment);
			}
		}

		return annotations;
	};


	module.extractHandler = extractHandlerObject;
	module.extractUseHandlerAnnotation = extractUseHandlerAnnotation;


	return module;
});