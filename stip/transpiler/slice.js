var toCode = function (option, slicednodes, node) {
    switch (option.target) {
        case 'normal':
            return JSify.transpile(slicednodes, node, option.cps)
        case 'meteor':
            return Meteorify.transpile(slicednodes, node)
        case 'node.js':
            return Nodeify.transpile(slicednodes, node, option)
    }
}

var addPrimitives = function (option) {
    switch (option) {
        case 'normal':
            // TODO'
            return [];
        case 'meteor':
            return meteorPrimitives();
    }
}

var addFooter = function (option, sliced) {
    /*switch (option.target) {
        case 'node.js':
            if(option.tier === 'client')
                sliced.footer = nodeFooterC();
            else 
                sliced.footer = nodeFooterS();
    }*/
    return sliced;
}

var addHeader = function (option, sliced) {

    switch (option.target) {
        case 'node.js':
            if(option.tier === 'client')
                sliced.setup = sliced.setup.concat(NodeParse.createClient());
            else
                sliced.setup = sliced.setup.concat(NodeParse.createServer());
    }

    if (option.asynccomm === 'callbacks' && option.target === 'node.js') {
		var handlers      = [],
		    proxies       = [],
		    totalRpcCount = 0,
            removedHandlers = {},
            definedHandlers;

		Handler.Generate.init();      

        //filter out handlers that are not defined
        definedHandlers = option.failurehandlers.reduce(
            function(previousValue, current){
                
                if(removedHandlers[current.getParent()])
                    current.setParent(removedHandlers[current.getParent()]);
                var parent = current.getParent();
                
                if(current.getRpcCount() == 0 && !Handler.Generate.handlerDefinition(current)){
                    removedHandlers[current.getUniqueName()] = parent;
                }else{
                    previousValue.push(current);
                }
                
                return previousValue;
        }, []);

		definedHandlers.map(function (el) {
            
            totalRpcCount = totalRpcCount + el.getRpcCount();
			handlers = handlers.concat(Handler.Generate.handlerNode(el));
			
			//we only need a leaf if there are calls to this handler.
			if (el.getRpcCount() > 0) {
				var proxyName = Handler.makeProxyName(el.getUniqueName())
				proxies = proxies.concat(Handler.Generate.proxyDefinition(proxyName, el.getLeafName()));
			}
		});

		//only add handlers if there are RPCs
		if(totalRpcCount > 0){
			sliced.setup = sliced.setup.concat(Handler.Generate.proxySetup());

			handlers.map(function(el){
				sliced.setup = sliced.setup.concat(el);
			});

			proxies.map(function (el) {
				sliced.setup = sliced.setup.concat(el)
			});
		}
	}

    return sliced;
}

/*
 * Transformation needed on the body code
 */
var transformBody = function (option, slicing, body, methods) {
    switch (option.target) {
        case 'node.js':
            if (option.tier === 'client') {
                var methodsDecl = NodeParse.methodsClient();
                methodsDecl.expression.arguments = methods;
                /* Add cloud types declarations */
                for(var name in slicing.cloudtypes) {
                    if(slicing.cloudtypes.hasOwnProperty(name)) {
                        var cloudtype = slicing.cloudtypes[name];
                        body = [cloudtype.declarationC].concat(body);
                    }
                }

                return body.concat(methodsDecl);
            }
            else {
                /* server rpcs + cloudtypes are added */
                var methodsDecl = NodeParse.methodsServer();
                methodsDecl.expression.arguments = methods;

                /* Declare cloud types + add their declarations as well (for use on server side as well) */
                for(var name in slicing.cloudtypes) {
                    if(slicing.cloudtypes.hasOwnProperty(name)) {
                        var cloudtype = slicing.cloudtypes[name];
                        body = [cloudtype.declarationS].concat(cloudtype.declarationC).concat(body);
                    }
                }

                return body.concat(methodsDecl);
            }
        case 'meteor':
            if (option.tier === 'server') {
                /* remote procedure definitions are added */
                var methodsDecl = MeteorParse.methodsServer();
                methodsDecl.expression.arguments = methods;

                return body.concat(methodsDecl);
            }
            if (option.tier === 'client') {
                /* remote procedure definitions are added */
                var methodsDecl = MeteorParse.methodsClient();
                methodsDecl.expression.arguments = methods;

                return body.concat(methodsDecl);
            }
    }
    return body
}

/* 
 * Starting from a set of nodes, create the corresponding transformed code.
 * This function also adds header and footer code, depending on the choosen output
 */
var constructProgram = function (nodes, option) {
    var createProgram = function (body) { 
            return {
                'type' : 'Program',
                'body' : body ? body : [] 
                }
            },
        program = createProgram(),
        nosetup = createProgram(),
        slicing, 
        methods = [];

    //program.body = addPrimitives(option);
    option.failurehandlers = [];
    while (nodes.length > 0) {
        var n = nodes.shift();
        if(n.parsenode) {
            slicing = toCode(option, nodes, n);
            if(slicing.parsednode) {
                program.body = program.body.concat(slicing.parsednode);
            }

        	if(n.parsenode.handlersAsync){
        		n.parsenode.handlersAsync.map(function (el){
        			if(option.failurehandlers.indexOf(el) === -1){
        				option.failurehandlers.push(el)
        			}
        		});
        	}

            nodes = slicing.nodes;  
            option.cloudtypes = slicing.cloudtypes;
            methods = methods.concat(slicing.methods);
        }
    };

    addHeader(option, slicing);
    addFooter(option, slicing);
    program.body = transformBody(option, slicing, program.body, methods);
    nosetup.body = program.body;
    program.body = slicing.setup.concat(program.body).concat(slicing.footer);
    console.log(program);

    if (option.tier === 'client') {
        program.cloudtypes = slicing.cloudtypes;
    }

    return {
        program : program,
        setup   : createProgram(slicing.setup),
        nosetup : nosetup
    }
}

var Sliced = function (nodes, node, parsednode) {
    this.nodes       = nodes;
    this.node        = node;
    this.parsednode  = parsednode;

    this.setup       = [];
    this.footer      = [];
    
    this.method      = {};
    this.methods     = [];
    this.streams     = [];

    this.cloudtypes      = {};
}

var cloneSliced = function (sliced, nodes, node) {
    var clone = new Sliced(nodes, node);

    clone.methods    = sliced.methods;
    clone.setup      = sliced.setup;
    clone.streams    = sliced.streams;
    clone.cloudtypes = sliced.cloudtypes;
    clone.option     = sliced.option;

    return clone;
}

var setUpContains = function (sliced, name) {

    return sliced.setup.filter(function (pars) {
        
        return pars.type === "VariableDeclaration" && 
            pars.declarations[0].id.name === name
    }).length > 0;
}
