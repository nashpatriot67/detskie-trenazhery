(function(root){
'use strict';
// Shared public range. 1000 is the boundary represented by ten hundreds;
// this stage deliberately does not introduce a movable thousands piece.
const MAX=1000,NORMAL_MAX=999;
function isValue(n){return Number.isInteger(n)&&n>=0&&n<=MAX;}
function draft(value){return typeof value==='string'?value.replace(/[^0-9]/g,'').slice(0,4):'';}
root.MathRange=Object.freeze({MAX,NORMAL_MAX,isValue,draft});
})(typeof window==='undefined'?globalThis:window);
