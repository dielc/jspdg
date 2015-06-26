'use strict';

var handlerTransform = (function () {

	var module = {};

	var renameIdentifier = function (identifier, string) {
		return identifier + string;
	};

	var createBlockStatement = function (body) {
		return {
			type: 'BlockStatement',
			body: body
		}
	};

    var createIdentifier = function (name){
        return {
            "type": "Identifier",
            "name": name
        }
    }

	var createField = function (fieldName, rhs) {
		return function (name) {
			var newName = renameIdentifier(fieldName, name) || fieldName;
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
							'name': newName
						}
					},
					'right': JSON.parse(JSON.stringify(rhs))
				}
			}
		};
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
					'right': JSON.parse(JSON.stringify(functionExpressionNode))
				}
			}
		};
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
						'body': JSON.parse(JSON.stringify(bodyNode))
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

    var createHandlerIdentifier = function (objectName, id) {
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
                        'name': 'id'
                    }
                },
                'right': {
                    'type': 'Literal',
                    'value': id,
                    'raw': id.toString()
                }
            }
        }
    };

	// var createPriorityMethod = function (objectName, hasPriority) {
	// 	return {
	// 		'type': 'ExpressionStatement',
	// 		'expression': {
	// 			'type': 'AssignmentExpression',
	// 			'operator': '=',
	// 			'left': {
	// 				'type': 'MemberExpression',
	// 				'computed': false,
	// 				'object': {
	// 					'type': 'Identifier',
	// 					'name': objectName
	// 				},
	// 				'property': {
	// 					'type': 'Identifier',
	// 					'name': 'flagPriority'
	// 				}
	// 			},
	// 			'right': {
	// 				'type': 'Literal',
	// 				'value': hasPriority,
	// 				'raw': hasPriority.toString()
	// 			}
	// 		}
	// 	}
	// };

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

	// var createToStringMethod = function (objectName) {
	// 	return {
	// 		'type': 'ExpressionStatement',
	// 		'expression': {
	// 			'type': 'AssignmentExpression',
	// 			'operator': '=',
	// 			'left': {
	// 				'type': 'MemberExpression',
	// 				'computed': false,
	// 				'object': {
	// 					'type': 'MemberExpression',
	// 					'computed': false,
	// 					'object': {
	// 						'type': 'Identifier',
	// 						'name': objectName
	// 					},
	// 					'property': {
	// 						'type': 'Identifier',
	// 						'name': 'prototype'
	// 					}
	// 				},
	// 				'property': {
	// 					'type': 'Identifier',
	// 					'name': 'toString'
	// 				}
	// 			},
	// 			'right': {
	// 				'type': 'FunctionExpression',
	// 				'id': null,
	// 				'params': [],
	// 				'defaults': [],
	// 				'body': {
	// 					'type': 'BlockStatement',
	// 					'body': [{
	// 						'type': 'ReturnStatement',
	// 						'argument': {
	// 							'type': 'Literal',
	// 							'value': ' -' + objectName,
	// 							'raw': ' - ' + objectName
	// 						}
	// 					}]
	// 				},
	// 				'generator': false,
	// 				'expression': false
	// 			}
	// 		}
	// 	}
	// };

	var makeHandler = function (handlerMethods, constructorBody, identifiers) {
		identifiers = identifiers || [];

		var renameSelfIdentifiers = function (parsenode, string, handlerName) {
			estraverse.replace(parsenode, {
				enter: function (node) {

					if (esp_isMemberExpression(node) && esp_isThisExpression(node.object) && esp_isIdentifier(node.property)) {
						var fieldToRename = node.property.name;
						if (identifiers.indexOf(fieldToRename) !== -1) {
							node.property.name = renameIdentifier(fieldToRename, string);
						}else if(fieldToRename === 'id'){
                            node.object = createIdentifier(handlerName)
                        }
					}
				}
			});
		}



		return {
			handlerMethods: function () {
				return handlerMethods.slice();
			},
			constructorBody: function (name) {
				return constructorBody.slice().map(function (e) {
					var stm = e(name);
					renameSelfIdentifiers(stm, name, name);
					return stm;
				});
			},
			//keep the current handler info accessible as annotations in code will decide where
			//constructorBody and the methods will end up.
			newHandler: function (id, handlerName, parentNodeName, hasPriority, methods, body) {
				var handler = [];

				handler.push(createConstructor(handlerName, body));

				if (parentNodeName)
					handler.push(createSuperMethod(handlerName, parentNodeName));
                
                if(id)
                    handler.push(createHandlerIdentifier(handlerName, id));

				//handler.push(createPriorityMethod(handlerName, hasPriority));
				handler.push(createSetPrototype(handlerName));
				handler.push(createSetConstructor(handlerName));
				//handler.push(createToStringMethod(handlerName));

				methods.map(function (method) {
					handler.push(method(handlerName));
				});

				var result = createBlockStatement(handler);
				//rename all identifiers that have to be renamed and are not yet renamed.
				renameSelfIdentifiers(result, (body.length === 0) ? handlerName : parentNodeName, handlerName);

				return result;
			}
		}
	};

	var isSpecialHandlerProperty = function (node) {
		return Handler.handlerMethods.indexOf(node.key.name) != -1;
	};

	/*
		Takes a handler in JS object literal notation and performs the necessary transformations.
	*/
	var extractHandlerObject = function (node) {
		var name              = node.id.name;
		var methods           = [];
		var constructorBody   = [];
		var identifiersRename = [];
        var hasHandlerMethod  = false;

        //Perform renames and warn about inconsistencies
		estraverse.replace(node, {
			enter: function (node, parent) {

                if (esp_isProperty(node) && esp_isIdentifier(node.key) && Handler.reservedKeywords.indexOf(node.key.name) != -1){
                    console.log('Warning ' + node.key.name + " is a reserved keyword, consider renaming it.");
                    identifiersRename.push(node.key.name);
                } 

				//replace first arg of special handler methods by field access.
				if (esp_isProperty(node) && esp_isIdentifier(node.key) && isSpecialHandlerProperty(node)) {
                    hasHandlerMethod = true;
					if (node.value.params.length && esp_isIdentifier(node.value.params[0])) { //first arg
						var argName = node.value.params[0].name;
						node.value.params = [];

						//only in the body of the method
						var body = node.value.body;
						estraverse.replace(body, {
							enter: function (node, parent) {
								if (esp_isIdentifier(node) && node.name === argName) {

									if (parent.property && parent.property.name && Handler.callInterface.indexOf(parent.property.name) === -1)
										throw new Error('Error: identifier \'' + parent.property.name + '\' does not appear in call interface in ' + name +'.');

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
							}
						});
					}
				}

				//Take the field identifiers in: var obj = {field:...} for renaming.
				if (esp_isProperty(node) && esp_isIdentifier(node.key)) {
					if (esp_isFunExp(node.value) && isSpecialHandlerProperty(node))
						return;

					var fieldToRename = node.key.name;
					identifiersRename.push(fieldToRename);
				}
			}
		});

        if(!hasHandlerMethod){
            console.log('Handler ' + name + ' does not have one of the required handler methods. Consider adding one of: ' + Handler.handlerMethods.toString() + ".")
        }

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

		if (Handler.defined[name])
			console.log('Warning overriding handler \'' + name + '\'.');

		Handler.defined[name] = makeHandler(methods, constructorBody, identifiersRename);
	};


	var makeHandlerAnnotation = function (parent, uniqueName, handler, priority, id) {
		return {
			_parent: parent,
			_uniqueName: uniqueName,
			_handler: handler,
			_rpcCount: 0,
			_priority: priority,
			_leafName: Handler.makeLeafName(uniqueName),
            _id: id,

			getParent: function () {
				return this._parent;
			},
			setParent: function (parent) {
				this._parent = parent;
			},

			getUniqueName: function () {
				return this._uniqueName;
			},
			setUniqueName: function (uniqueName) {
				this._uniqueName = uniqueName;
			},

			getHandler: function () {
				return this._handler;
			},
			setHandler: function (handler) {
				this._handler = handler;
			},

			getRpcCount: function () {
				return this._rpcCount;
			},
			setRpcCount: function (rpcCount) {
				this._rpcCount = rpcCount;
			},
			incRpcCount: function () {
				this._rpcCount++;
			},

			getPriority: function () {
				return this._priority;
			},
			setPriority: function (priority) {
				this._priority = priority;
			},

            getId: function () {
                return this._id;
            },
            setId: function (id) {
                this._id = id;
            },

			getLeafName: function () {
				return this._leafName;
			},
			setLeafName: function (leafName) {
				this._leafName = leafName;
			},

			isTopNode: function () {
				return this._uniqueName === this._parent;
			}
		}
	};

	/*
		Takes a handler in JS object literal notation and performs the necessary transformations.
	*/
	var extractUseHandlerAnnotation = function (lastParent, comment) {
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

				var annotationInfo = makeHandlerAnnotation(currentName, currentName, m, priority, Handler.handlerCtr);

				if (lastParent) {
					//last one added is our parent
					annotationInfo.setParent(lastParent.getUniqueName());
				}

				annotations.push(annotationInfo);
				lastParent = annotationInfo;
				match = regexp.exec(comment);
			}
		}

		return annotations;
	};

	module.handlerDefinition = extractHandlerObject;
	module.HandlerAnnotation = extractUseHandlerAnnotation;

	return module;
});