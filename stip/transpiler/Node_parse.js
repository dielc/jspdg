/* * * * * * * * * * * * * * *
 *          CLIENT           *
 * * * * * * * * * * * * * * */

var NodeParse = (function () {

    var module = {};


    var createVarDecl = function (declarator) {
        return {
            type            : 'VariableDeclaration',
            declarations    : [ declarator ],
            kind            : 'var'
        }
    }
       
     /*  Representation of a callback function :
     *    callback(errx, resx) {}
     */
    var callback = function (cnt, syncHandler) {
        var body = [];
        if(syncHandler){
            body = [{
                "type": "TryStatement",
                "block": {
                    "type": "BlockStatement",
                    "body": [
                        {
                            "type": "IfStatement",
                            "test": {
                                "type": "Identifier",
                                "name": "err"+cnt
                            },
                            "consequent": {
                                "type": "ThrowStatement",
                                "argument": {
                                    "type": "Identifier",
                                    "name": "err"+cnt
                                }
                            },
                            "alternate": null
                        }
                        ]
                },
                "guardedHandlers": [],
                "handlers": syncHandler.handlers.slice(),
                //"handler": syncHandler.handlers,
                "finalizer": syncHandler.finalizer
            }];
        }   

        return {  parsenode :{
                    "type": "FunctionExpression",
                    "id": null,
                    "params": [
                        {
                            "type": "Identifier",
                            "name": "err"+cnt
                        },
                        {
                            "type": "Identifier",
                            "name": "res"+cnt
                        }
                    ],
                    "defaults": [],
                    "body": {
                        "type": "BlockStatement",
                        "body": body
                    },
                    "rest": null,
                    "generator": false,
                    "expression": false
                  }, 
                  addBodyStm : function (stm, insideTry) {
                        console.log('-> addBodyStm', stm, insideTry)
                        if(syncHandler && (insideTry === undefined || insideTry)){
                            this.parsenode.body.body[0].block.body = this.parsenode.body.body[0].block.body.concat(stm)
                        }else{
                            this.parsenode.body.body = this.parsenode.body.body.concat(stm)
                        }

                            
                    
                  },
                  setBody    : function (body) {
                    if(syncHandler){
                       this.parsenode.body.body[0].block.body = body; 
                    }else{
                        this.parsenode.body.body = body
                    }

                    
                  },
                  getBody    : function () {
                    if(syncHandler){
                       return this.parsenode.body.body[0].block.body; 
                    }else{
                        return this.parsenode.body.body;
                    }
                  },
                  getResPar  : function () {
                    return this.parsenode.params[1];
                  },
                  getErrPar  : function () {
                    return this.parsenode.params[0];
                  }
         }
    }

    /* Representation of a remote procedurecall from client -> server:
     *   client.rpc(fname, args, callback(err, res) {})
     */

    var RPC = function (call, fname, args) {
        return { parsenode  : 
                        {   "callnode"  : call,
                            "type"      : "ExpressionStatement",
                            "expression": {
                                "type"      : "CallExpression",
                                "callee"    : {
                                    "type"      : "MemberExpression",
                                    "computed"  : false,
                                    "object"    : {
                                        "type"  : "Identifier",
                                        "name"  : "client"
                                            },
                                    "property"  : {
                                        "type"  : "Identifier",
                                        "name"  : "rpc"
                                    }
                                },
                                "arguments" : [
                                    {
                                        "type"  : "Literal",
                                        "value" : fname
                                    }].concat( args ? args : [])
                            }
                        },
                  isRPC     : true,
                  addArg    : function (arg) {
                    this.parsenode.expression.arguments = this.parsenode.expression.arguments.concat(arg)
                  },
                  replaceArg : function (prev, arg) {
                    if (this.parsenode.expression)
                        for (var i = 0; i < this.parsenode.expression.arguments.length; i++) {
                            var current = this.parsenode.expression.arguments[i];
                            if (current === prev) 
                                this.parsenode.expression.arguments[i] = arg;
                        }
                  },
                  setCallback : function (cb) {
                    this.callback = cb;
                  },
                  updateCallback : function (cb) {
                    if(this.parsenode.expression && this.parsenode.expression.arguments) {
                        var argsp = this.parsenode.expression.arguments;
                        argsp[argsp.length-1] = cb.parsenode;
                        this.callback = cb;
                    }
                  },
                  setObjectName: function (name) {
                     this.parsenode.expression.callee.object.name = name
                  },
                  setName : function (name) {
                    this.parsenode.expression.arguments[0].value = name
                  },
                


                  getCallback : function () {
                    if (this.callback) 
                        return this.callback
                    else if (this.parsenode.expression) {
                        var argsp = this.parsenode.expression.arguments,
                            newcb = callback(0); /*  count does not matter at this point */
                        newcb.parsenode = argsp[argsp.length-1]
                        return newcb
                    }
                  }
        }
    }


    /* 
     * Representation of an async function (takes an extra argument callback)
     *   
     */

    var asyncFun = function () {
        return {
            parsenode :  {
                "type": "ObjectExpression",
                "properties": [
                    {
                        "type": "Property",
                        "key": {
                            "type": "Literal",
                            // Name must be set by vardecl
                            "value": "",
                        },
                        "value": {
                            "type": "FunctionExpression",
                            "id": null,
                            "params": [],
                            "defaults": [],
                            "body": {
                                "type": "BlockStatement",
                                "body": []
                            },
                            "rest": null,
                            "generator": false,
                            "expression": false
                        },
                        "kind": "init"
                    }
                ]
          }, 

            setBody : function (body) {
                this.parsenode.properties[0].value.body.body = body 
            }, 

            addParams : function (params) {
                this.parsenode.properties[0].value.params = params;
            },

            setName : function (name) {
                this.parsenode.properties[0].key.value = name;
            }
        }
    }



    var createServer = function () {
        return esprima.parse('var server = new ServerRpc(app, 8080, {});').body[0];
    }

    var createClient = function () {
        return esprima.parse("var client = new ClientRpc('http://127.0.0.1:8080', {});").body[0];
    }

    var methodsServer = function () {
        return esprima.parse('server.expose({});').body[0]; 
    }

    var methodsClient = function () {
        return esprima.parse('client.expose({});').body[0];
    }



    module.createVarDecl  = createVarDecl;
    module.callback       = callback;
    module.RPC            = RPC;
    module.asyncFun       = asyncFun;
    module.methodsClient  = methodsClient;
    module.methodsServer  = methodsServer; 
    module.createServer   = createServer;
    module.createClient   = createClient;

    return module;

})();