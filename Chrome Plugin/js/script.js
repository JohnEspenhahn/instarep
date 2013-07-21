'use strict';

document.mycmid = chrome.contextMenus.create( 
	{ title: "Search Instarep for '%s'", 
	  contexts: ["selection"], 
	  "onclick": searchInsta
	});

function searchInsta(info, tab) {
	var selectedTxt = encodeURIComponent(info.selectionText),
		win = window.open("http://instarep.org/?bill=" + selectedTxt, "_blank");
	
	win.focus();
}