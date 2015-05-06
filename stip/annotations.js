/*
 * Works on the level of esprima nodes
 */



var Comments = (function () {

    var module = {};

    var handlers = [];

    // Client
    var client_annotation      = "@client";
    var server_annotation      = "@server";
    var assumes_annotation     = "@assumes";
    var use_handler_annotation = "@useHandler";
	var define_handler_annotation = "@defineHandlers";
    

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

    var isTierAnnotated = function (node) {
        return node.leadingComment &&
               esp_isBlockStm(node) &&
               (isServerAnnotated(node.leadingComment) ||
                isClientAnnotated(node.leadingComment))
    }

    var registerHandler = function (handler) {
        handlers.push(handler);
    }
    
    var handleComment = function (node, pdgNode, upnode) {
    	handlers.map(function (handler) {
	        handler(node.leadingComment, pdgNode, upnode, node)
	    });
    }

    var handleBlockComment = function (comment, pdgNodes) {
        pdgNodes.map(function (pdgNode) {
        	//console.log('handleBlockComment', comment.value)
            if (esp_isBlockStm(pdgNode.parsenode)) {
                if (isClientAnnotated(comment)) 
                    graphs.PDG.addClientStm(pdgNode)
                else if (isServerAnnotated(comment))
                    graphs.PDG.addServerStm(pdgNode)
            }
        })
    }


    var handleUseHandler = function (comment, pdgNodes, upnode, node) {

    	pdgNodes.map(function (pdgNode) {

    		if (esp_isBlockStm(pdgNode.parsenode) && isUseHandlerAnnotated(comment)) {
    			if(!node.handlers){
    				node.handlers = []
    			}
			}
    	})
    };

    registerHandler(handleBlockComment);
    //registerHandler(handleUseHandler);

    module.handleComment      = handleComment;
    module.registerHandler    = registerHandler;
    module.isAssumesAnnotated = isAssumesAnnotated;
    module.isTierAnnotated    = isTierAnnotated;
    module.isUseHandlerAnnotated = isUseHandlerAnnotated;
    module.isDefineHandlerAnnotated = isDefineHandlerAnnotated;

    return module


})()

