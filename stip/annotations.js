/*
 * Works on the level of esprima nodes
 */

// Client
var client_annotation = "@client";
var server_annotation = "@server";
var assumes_annotation = "@assumes";
var use_handler_annotation    = "@useHandler";
var define_handler_annotation = "@defineHandlers";


// Client annotations is @client in comment
var isClientAnnotated = function (node) {
  return node.leadingComment && node.leadingComment.value.indexOf(client_annotation) != -1;
}

// Server annotations is @server in comment
var isServerAnnotated = function (node) {
  return node.leadingComment && node.leadingComment.value.indexOf(server_annotation) != -1;
}

var isAssumesAnnotated = function (string) {
	return string.indexOf(assumes_annotation) != -1;
}

var isUseHandlerAnnotatedNode = function (node) {
	return node.leadingComment && node.leadingComment.value.indexOf(use_handler_annotation) != -1;
};

var isDefineHandlerAnnotated = function (node) {
	return node.leadingComment && node.leadingComment.value.indexOf(define_handler_annotation) != -1;
};