var cmid = chrome.contextMenus.create( {title: "Search Instarep", contexts: ["selection"], "onclick": searchInsta} );

// TODO not working
$(window).mouseup(function() {
	console.log("Mouse up");
	var text = window.getSelection().toString();
	if (text == "") {
		if (cmid != null) {
			chrome.contextMenus.remove(cmid);
			cmid = null;
		}
	} else {
		var options = {
			title: "Search Instarep for '" + text + "'", 
			contexts: ["selection"], 
			"onclick": searchInsta
		};
		
		if (cmid != null) {
			chrome.contextMenus.update(cmid, options);
		} else {
			cmid = chrome.contextMenus.create(options);
		}
	}
});

function searchInsta(info, tab) {
	var selectedTxt = encodeURIComponent(info.selectionText),
		win = window.open("http://instarep.org/?bill=" + selectedTxt, "_blank");
	
	win.focus();
}