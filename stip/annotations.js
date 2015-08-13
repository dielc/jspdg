/*
 * Works on the level of esprima nodes
 */



var Comments = (function () {

    var module = {};

    var beforeHandlers = [];
    var afterHandlers  = [];

    // Client
    var client_annotation      = "@client";
    var server_annotation      = "@server";
    var assumes_annotation     = "@assumes";
    var use_handler_annotation = "@useHandler";
	var define_handler_annotation = "@defineHandlers";
    var reply_annotation     = "@reply";
    var broadcast_annotation = "@broadcast";
    var blocking_annotation  = "@blocking"


    // Client annotations is @client in comment
    var isClientAnnotated = function (comment) {
      return comment.value.indexOf(client_annotation) != -1;
    }

    // Server annotations is @server in comment
    var isServerAnnotated = function (comment) {
      return comment.value.indexOf(server_annotation) != -1;
    }

    var isAssumesAnnotated = function (string) {
    	return string.indexOf(assumes_annotation) != -1;
    }

    var isUseHandlerAnnotated = function (comment) {
		return comment.value.indexOf(use_handler_annotation) != -1;
	};

	var isDefineHandlerAnnotated = function (node) {
		return node.leadingComment && node.leadingComment.value.indexOf(define_handler_annotation) != -1;
	};

    var isReplyAnnotated = function (comment) {
        return comment.value.indexOf(reply_annotation) != -1;
    }

    var isBroadcastAnnotated = function (comment) {
        return comment.value.indexOf(broadcast_annotation) != -1;
    }

    var isBlockingAnnotated = function (comment) {
        return comment.value.indexOf(blocking_annotation) != -1;
    }

    var isTierAnnotated = function (node) {
        return node.leadingComment &&
               esp_isBlockStm(node) &&
               (isServerAnnotated(node.leadingComment) ||
                isClientAnnotated(node.leadingComment))
    }

    var registerBeforeHandler = function (handler) {
        beforeHandlers.push(handler)
    }

    var registerAfterHandler = function (handler) {
        afterHandlers.push(handler)
    }
    
    /*  Before handlers are called right before the parsenode is turned into a pdg node */
    var handleBeforeComment = function (comment, parsenode, upnode) {
        beforeHandlers.map(function (handler) {
            handler(comment, parsenode, upnode)
        })
    }

    var handleAfterComment = function (comment, pdgNode, upnode) {
        afterHandlers.map(function (handler) {
            handler(comment, pdgNode, upnode)
        })
    }

    var handleBlockComment = function (comment, pdgNodes) {
        pdgNodes.map(function (pdgNode) {
            if (esp_isBlockStm(pdgNode.parsenode)) {
                if (isClientAnnotated(comment)) 
                    graphs.PDG.addClientStm(pdgNode)
                else if (isServerAnnotated(comment))
                    graphs.PDG.addServerStm(pdgNode)
            }
        })
    }

    var handleUseHandler = function (comment, parsenode, upnode) {
        var node = parsenode,
            handlerCtr = parsenode.handlersAsync.length,
    	    lastParent = (handlerCtr === 0) ? undefined : parsenode.handlersAsync[handlerCtr - 1],
        	extraHandlers = Handler.Transform.HandlerAnnotation(lastParent, comment.value);
		
        node.handlersAsync = node.handlersAsync.concat(extraHandlers);	

    };

    var handleReplyComment = function (comment, pdgNodes) {
        pdgNodes.map(function (pdgNode) {
            var callnodes;
            if (isReplyAnnotated(comment)) {
                if (pdgNode.isCallNode) 
                    pdgNode.arity = ARITY.ONE;
                else {
                    callnodes = pdgNode.findCallNodes();
                    callnodes.map(function (callNode) {
                        callNode.arity = ARITY.ONE
                    })
                }
            }
        })
    }

    var handleBroadcastComment = function (comment, pdgNodes) {
        pdgNodes.map(function (pdgNode) {
            var callnodes;
            if (isBroadcastAnnotated(comment)) {
                if (pdgNode.isCallNode) 
                    pdgNode.arity = ARITY.ALL;
                else {
                    callnodes = pdgNode.findCallNodes();
                    callnodes.map(function (callNode) {
                        callNode.arity = ARITY.ALL;
                    })
                }
            }
        })
    }

    var handleBlockingComment = function (comment, pdgNodes) {
        pdgNodes.map(function (pdgNode) {
            var callnodes;
            if (isBlockingAnnotated(comment)) {
                if (!esp_isCallExp(pdgNode.parsenode)) {
                    callnodes = pdgNode.findCallNodes();
                    callnodes.map(function (callNode) {
                        callNode.parsenode.leadingComment = comment;
                    })
                } 
                if (pdgNode.isCallNode && esp_isExpStm(pdgNode.parsenode)) {
                    pdgNode.parsenode.expression.leadingComment = comment;
                }
            }
        })
    }


    registerBeforeHandler(handleUseHandler);
    registerAfterHandler(handleReplyComment);
    registerAfterHandler(handleBroadcastComment);
    registerAfterHandler(handleBlockingComment);
   // registerAfterHandler(handleBlockComment);


    module.handleBeforeComment      = handleBeforeComment;
    module.handleAfterComment       = handleAfterComment;
    module.registerBeforeHandler    = registerBeforeHandler;
    module.registerAfterHandler     = registerAfterHandler;
    module.isAssumesAnnotated       = isAssumesAnnotated;
    module.isTierAnnotated          = isTierAnnotated;
    module.isServerAnnotated        = isServerAnnotated;
    module.isClientAnnotated        = isClientAnnotated;
    module.isDefineHandlerAnnotated = isDefineHandlerAnnotated;
    module.isBlockingAnnotated      = isBlockingAnnotated;

    return module


})()

