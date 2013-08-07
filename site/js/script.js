///////////////////////
// Variables
///////////////////////
var color_red = "#F2DEDE", color_green = "#DFF0D8", color_yellow = "#FCF8E3";

///////////////////////
// Address to LatLong
///////////////////////
google.maps.event.addDomListener(window, 'load', initialize);

var geocoder;
function initialize() {
    window.docReps = [];
	geocoder = new google.maps.Geocoder();

	if (checkCookie("ir_state") && checkCookie("ir_district_House") && checkCookie("ir_district_Senate")) {
		locationSavedMessage();
		getLegislatorFromStateAndDistricts(getCookie("ir_state"), getCookie("ir_district_House"), getCookie("ir_district_Senate"));
	} else {
		element("name").innerHTML = 'Please enter your location in the "Change Location" tab.';
		gotoAddressTab();
	}
}

function currentLocation() {
	clearCookies();
	initWithLatLong();
	
	gotoSearchTab();
}

function codeAddress() {
	var locStateElm = element("locState");
	element("state").value = locStateElm.value;

	var street = element("locStreet").value,
	  city = element("locCity").value,
	  state = element("locState").value;
	  
	if (state == "") {
		element("locationMss").innerHTML = "<span class='error'>Please provide your state or choose 'Use Current Location':</span>";
		return;
	} else if (city == "") {
		element("locationMss").innerHTML = "<span class='error'>Please provide your city or choose 'Use Current Location':</span>";
		return;
	} else if (street == "") {
		element("locationMss").innerHTML = "<span class='error'>Please provide your street or choose 'Use Current Location':</span>";
		return;
	}

	var address = street+" "+city+", "+state,
	  swBound = new google.maps.LatLng(22.350076,-63.294983),
	  neBound = new google.maps.LatLng(73.124945,169.398193),
	  bounds =  new google.maps.LatLngBounds(swBound,neBound);

	geocoder.geocode( { 'address': address, 'bounds': bounds}, function(results, status) {
		if (status == google.maps.GeocoderStatus.OK) {
			clearCookies();
			
			setCookie("ir_state", state, 365);
			getLegislatorsFromLatLong(results[0].geometry.location.jb, results[0].geometry.location.kb);
			
			gotoSearchTab();
		} else {
			window.alert('Geocode was not successful for the following reason: ' + status);
		}
	});
}

function clearCookies() {
	deleteCookie("ir_state");
	deleteCookie("ir_district_House");
	deleteCookie("ir_district_Senate");
}

///////////////////////
// Instarep Lookup
///////////////////////
function gotoAddressTab() {
	$('#tabs a[href="#addressLoc"]').tab("show");
}

function gotoSearchTab() {
	$('#tabs a[href="#search"]').tab("show");
}

function element(id) {
	return document.getElementById(id);
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function locationSavedMessage() {
	element("locationMss").innerHTML = "Your residential region (but not your exact address) has been stored locally.";
}

function convertChamber(val) {
	if (val.chamber == "lower")
		val.chamber = "House";
	else if (val.chamber == "upper")
		val.chamber = "Senate";
}

// Use geolocation to get the user's current latitude and longitude and go from there
function initWithLatLong() {
	if (navigator.geolocation) {
		element("name").innerHTML = "Loading...";

		var locationTimeout = window.setTimeout(function() { element("name").innerHTML = "Failed to geolocate your position."; }, 3333);

		navigator.geolocation.getCurrentPosition(function(pos) {
			clearTimeout(locationTimeout);

			var lat = pos.coords.latitude,
				long = pos.coords.longitude;

			// Get state
			if (checkCookie("ir_state") && checkCookie("ir_district_House") && checkCookie("ir_district_Senate")) {
				var c_state = getCookie("ir_state"),
					c_district_House = getCookie("ir_district_House"),
					c_district_Senate = getCookie("ir_district_Senate");

				// Have both state and district, use them to lookup
				getLegislatorFromStateAndDistricts(c_state, c_district_House, c_district_Senate);
				element("state").value = c_state;
				element("district_House").value = c_district_House;
				element("district_Senate").value = c_district_Senate;
			} else {
				// Needed to save state cookie
				ajaxGoogleGetStateFromLatLong(lat, long);

				// Use latitude and longitude to find user's legislators
				getLegislatorsFromLatLong(lat, long);
			}
		});
	} else {
		element("name").innerHTML += "Geolocation is not supported by this browser.";
	}
}

// Use googleapis geocode to get state from current latitude and longitude
function ajaxGoogleGetStateFromLatLong(lat, long) {
	$.ajax({
		url: 'http://maps.googleapis.com/maps/api/geocode/json?latlng=' + lat + ',' + long + '&sensor=false',
		dataType: 'json',
		success: function(json) {
			var addrs = json.results[0].address_components, lng = addrs.length;
			for (var i=0; i<lng; i++) {
				var idx = $.inArray("administrative_area_level_1", addrs[i].types)
				if (idx != -1) { // If the types does contain
					setCookie("ir_state", addrs[i].short_name, 365);
					element("state").value = addrs[i].short_name;
					break;
				}
			}

			if (!checkCookie("ir_state")) {
				window.alert("Failed to find the state from your latitude and longitude.");
			}
		},
		error: function() { window.alert("Error connecting to Google Geocode API."); }
	});
}

// Use latitude and longitude to find legislators
function getLegislatorsFromLatLong(lat, long) {
	window.repsLoaded = false;
	clearInfo();
	window.docReps = [];

	element("name").innerHTML = "<table id='legInfo' border='1' cellpadding='5'><thead><tr style='font-style: italic; background-color: " + color_yellow + ";'><th>Chamber</th><th>Party</th><th>Name</th><th>Email</th><th>Vote</th></tr></thead><tbody id='legInfoBody'></tbody></table>";
	ajaxOpenStatesGetLegislatorsFromLatLong(lat, long);
}

// Run an ajax query to open states to get the legislators for the given latitude and longitude
function ajaxOpenStatesGetLegislatorsFromLatLong(lat, long) {
	$.ajax({
		url: 'http://openstates.org/api/v1/legislators/geo/?lat=' + lat + '&long=' + long + '&active=true&apikey=18cdbb31b096462985cf408a5a41d3af',
		dataType: 'jsonp',
		success: function(json) {
			var lng = json.length, val = null;

			window.docReps = [];
			if (lng <= 0) {
				element("name").innerHTML = "No representatives found.";
				return;
			}

			for(var i=json.length-1; i>=0; i--) {
				val = json[i];

				if (!val.active)
					continue;
				else
					convertChamber(val);

				// For search
				window.docReps.push(val.leg_id);
				element("district_" + val.chamber).value = val.district;
				setCookie("ir_district_" + val.chamber, val.district, 365);

				displayLegislator(val);
			}

			checkDoneLoading();
		},
		error: function() { window.alert("Error connecting to Open States API."); }
	});
}

// Use the state and districts to search from their legislator
function getLegislatorFromStateAndDistricts(state, house_district, senate_district) {
	window.repsLoaded = false;
	clearInfo();
	window.docReps = [];
	element("name").innerHTML = "<table id='legInfo' border='1' cellpadding='5'><thead><tr style='font-style: italic; background-color: " + color_yellow + ";'><th>Chamber</th><th>Party</th><th>Name</th><th>Email</th><th>Vote</th></tr></thead><tbody id='legInfoBody'></tbody></table>";

	setCookie("ir_state", state, 365);
	element("state").value = state;

	// House chamber (house)
	ajaxOpenStatesGetHouse(state, house_district);

	// Senate chamber (senate)
	ajaxOpenStatesGetSenate(state, senate_district);
}

// Get the congressman from the current state and district
function ajaxOpenStatesGetHouse(state, house_district) {
	$.ajax({
		url: 'http://openstates.org/api/v1/legislators/?state=' + state + '&district=' + house_district + 
				'&active=true&chamber=lower&apikey=18cdbb31b096462985cf408a5a41d3af',
		dataType: 'jsonp',
		success: function(json) {
			var lng = json.length, val = null;

			for(var lowIt=0; lowIt<lng; lowIt++) {
				val = json[lowIt];

				if (!val.active)
					continue;
				else
					convertChamber(val);

				// For search
				window.docReps.push(val.leg_id);
				element("district_House").value = val.district;
				setCookie("ir_district_House", val.district, 365);

				displayLegislator(val);
			}

			checkDoneLoading();
		},
		error: function() { window.alert("Error connecting to Open States API."); }
	});
}

// Get the senator from the current state and district
function ajaxOpenStatesGetSenate(state, senate_district) {
	$.ajax({
		url: 'http://openstates.org/api/v1/legislators/?state=' + state + '&district=' + senate_district + 
				'&active=true&chamber=upper&apikey=18cdbb31b096462985cf408a5a41d3af',
		dataType: 'jsonp',
		success: function(json) {
			var lng = json.length, val = null;

			for(var upIt=0; upIt<lng; upIt++) {
				val = json[upIt];

				if (!val.active)
					continue;
				else
					convertChamber(val);

				// For search
				window.docReps.push(val.leg_id);
				element("district_Senate").value = val.district;
				setCookie("ir_district_Senate", val.district, 365);

				displayLegislator(val);
			}

			checkDoneLoading();
		},
		error: function() { window.alert("Error connecting to Open States API."); }
	});
}

function checkDoneLoading() {
	var count = $('#legInfo tr').length;
	if (count < 3)
		return false;

	// Display and tell of update reps
	window.repsLoaded = true;
	locationSavedMessage();

	// Check for URL param
	var results = new RegExp("[\\?&]bill=([^&#]*)").exec(window.location.search);
	if (results != null) {
		element("bill_id").value = decodeURIComponent(results[1]);
		search();
	}
		
	return true;
}

function displayLegislator(val) {
	// Formatting
	if (val.email == undefined) {
		val.email = "";
	}
	
	// Display
	var row = element("legInfoBody").insertRow(-1);
	row.id = val.leg_id + "_voteRow";
	row.innerHTML = "<td>" + val.chamber + "</td><td>" + val.party + "</td><td>" + val.full_name + "</td>" +
		"<td><a href='mailto:" + val.email + "'>" + val.email + "</a></td><td id='" + val.leg_id + "_vote'>N/A</td></tr>";
}

function clearInfo() {
	element("other_bills").innerHTML = "";
	clearOldBill();
}

// Clear the info from the previous bill
function clearOldBill() {
	element("sources").innerHTML = "";
	element("bill_desc").innerHTML = "";

	var lng = docReps.length, reps = new Array(lng);
	for (var i=0; i<lng; i++) {
		var cellElmnt = element(window.docReps[i] + "_vote");
		if (cellElmnt !== null)
			cellElmnt.innerHTML = "N/A";

		// Set default row background color
		var rowElmnt = element(window.docReps[i] + "_voteRow");
		if (rowElmnt !== null)
			rowElmnt.bgColor = "white";
	}
}

// Update the cookies with the latest info
function updateCookies() {
	var locChange = false,
		state = element("state").value.toUpperCase(),
		district_House = element("district_House").value,
		district_Senate = element("district_Senate").value;

	if (getCookie("ir_state") != state) {
		setCookie("ir_state", element("state").value.toUpperCase(), 365);
		locChange = true;
	}
	if (getCookie("ir_district_House") != district_House) {
		setCookie("ir_district_House", district_House, 365);
		locChange = true;
	}
	if (getCookie("ir_district_Senate") != district_Senate) {
		setCookie("ir_district_Senate", district_Senate, 365);
		locChange = true;
	}
	if (locChange) getLegislatorFromStateAndDistricts(state, district_House, district_Senate);
}

// Called to display the bill
//   jsonBillId: The bill index of the json to display in detail
function displayBills(jsonBillId) {
	if (window.lastSearchJson.length > 1) {
		element("other_bills").innerHTML = "<p><h6>Other matching bills:</h6><ul>";
		
		var len = window.lastSearchJson.length - 1;
		for (var i=0; i<len; i++) {
			element("other_bills").innerHTML += "<li><a id='linkbill_" + i + "' href='javascript:switchToBill(" + i + ");'>" + window.lastSearchJson[i].title + "</a></li>";
		}
	}
	
	window.oldBill = jsonBillId;
	switchToBill(jsonBillId);
}

function switchToBill(jsonBillId) {
	var oldBill = element("linkbill_" + window.oldBill);
	if (oldBill != undefined)
		oldBill.style.fontWeight = "normal";

	window.oldBill = jsonBillId;
	
	var newBill = element("linkbill_" + window.oldBill);
	if (newBill != undefined)
		newBill.style.fontWeight = "bold";

	clearOldBill();
	$(document).scrollTop($("#info_anchor").offset().top);

	tableJson = window.lastSearchJson[jsonBillId];
	// No vote yet
	if (tableJson.votes.length <= 0) {
		element("bill_desc").innerHTML = "<b>No votes</b> on <i>" + tableJson.title + " (" + tableJson.bill_id + ")</i>.";
		displaySources(tableJson.sources);
	} else {
		// Convert from house/senate to house/senate
		convertChamber(tableJson);

		element("bill_desc").innerHTML = "Latest vote on <i>" + tableJson.title + " (" + tableJson.bill_id + ")</i> of the " + tableJson.chamber + ". <br />";
		displaySources(tableJson.sources);
		displayVotes(tableJson);
	}
}

// Display the vote for each representative
function displayVotes(tableJson) {
	// Read votes
	var votes = tableJson.votes[tableJson.votes.length-1],
		yes_votes = votes.yes_votes, yes_count = yes_votes.length,
		no_votes = votes.no_votes, no_count = no_votes.length,
		other_votes = votes.other_votes, other_count = other_votes.length;

	// Read representatives
	var docReps = window.docReps, lng = docReps.length, reps = new Array(lng);
	for (var i=0; i<lng; i++) {
		reps[i] = { voteCellId: docReps[i] + "_vote", voteRowId: docReps[i] + "_voteRow", leg_id: docReps[i] };
	}

	// Find representative's vote
	var i, j, r, found;
	for (i=0; i<lng; i++) {
		found = false;
		r = reps[i];
		for (j=0; j<yes_count; j++) {
			if (yes_votes[j].leg_id == r.leg_id) {
				element(r.voteCellId).innerHTML = "Yes";
				element(r.voteRowId).bgColor = color_green;
				found = true;
				break;
			}
		}
		if (found) continue; // No need to do other loops

		for (j=0; j<no_count; j++) {
			if (no_votes[j].leg_id == r.leg_id) {
				element(r.voteCellId).innerHTML = "No";
				element(r.voteRowId).bgColor = color_red;
				found = true;
				break;
			}
		}
		if (found) continue; // No need to do last loop

		for (j=0; j<other_count; j++) {
			if (other_votes[j].leg_id == r.leg_id) {
				element(r.voteCellId).innerHTML = "Absent";
				element(r.voteRowId).bgColor = "white";
				break;
			}
		}
	}
}

// Print the sources of the result
function displaySources(sources) {
	if (sources.length <= 0) return;

	var mss = "<h6> Sources: <br />";

	for (var i=0; i<sources.length; i++) {
		mss += "<a target='_blank' href='" + sources[i].url + "'>" + sources[i].url.match(/\/\/(.+?)\//)[1] + "</a> <br />";
	}
	mss += "</h6>";

	element("sources").innerHTML = mss;
}

function search() {
	if (window.repsLoaded !== true) {
		element("bill_desc").innerHTML = "Still trying to load your local representatives";
		return;
	} else if (window.searchingBill) {
		element("bill_desc").innerHTML = "Loading <i>" + window.searchingBill + "</i> already...";
		return;
	}

	window.searchingBill = formatBill(element("bill_id").value);
	clearInfo();

	// Update state and district cookies if different
	updateCookies();

	element("bill_desc").innerHTML = "Loading <i>" + window.searchingBill + "</i>...";

	// Remove old timer and add a new one
	createNewTimeout(function() { 
			window.searchingBill = "";
			element("bill_desc").innerHTML = "Load bill timed out. Are you sure you entered a valid bill?";
		}, 10000);

	// Submit the search string to open states
	var state = element("state").value.toUpperCase();
	ajaxOpenStatesGetBill(state, window.searchingBill);
}

function ajaxOpenStatesGetBill(state, bill_id) {
	$.ajax({
		url: "http://openstates.org/api/v1/bills/?state=" + state + "&search_window=session&q=" + bill_id + 
					"&fields=votes,votes.yes_votes,votes.no_votes,votes.other_votes,title,bill_id,chamber,sources&apikey=18cdbb31b096462985cf408a5a41d3af",
		dataType: 'jsonp',
		success: function(json) {
			var lng = json.length;
			if (lng <= 0) {
				element("bill_desc").innerHTML = "No bill found with the search '" + bill_id + "'.";

				// Some error helping
				if (bill_id.length > 1) {
					var firstChar = bill_id.charAt(0).toUpperCase();
					if (firstChar === 'H') {
						element("bill_desc").innerHTML += " If you're tring to search for a house bill use HB.";
					} else if (firstChar === 'S') {
						element("bill_desc").innerHTML += " If you're tring to search for a senate bill use SB.";
					}
				}
				// Clear the timeout timer
				window.clearTimeout(window.submitTimer);
			} else {
				window.clearTimeout(window.submitTimer);
				window.lastSearchJson = json;
				
				displayBills(0);
			}
			
			window.searchingBill = "";
		},
		error: function() { 
			window.searchingBill = "";
			window.alert("Error connecting to Open States API."); 
		}
	});
}

///////////////////////
// Util
///////////////////////
function createNewTimeout(func, timeout) {
	if (window.submitTimer != null) window.clearTimeout(window.submitTimer);
	window.submitTimer = window.setTimeout(func, timeout);
}

function formatBill(bill) {
	bill = bill.replace(new RegExp("house bill", 'gi'), "HB");
	bill = bill.replace(new RegExp("senate bill", 'gi'), "SB");
	
	return bill;
}

///////////////////////
// Cookie Helpers
///////////////////////
function getCookie(c_name) {
	var c_value = document.cookie,
		c_start = c_value.indexOf(" " + c_name + "=");
	if (c_start == -1) c_start = c_value.indexOf(c_name + "=");
	if (c_start == -1) {
		c_value = null;
	} else {
		c_start = c_value.indexOf("=", c_start) + 1;
		var c_end = c_value.indexOf(";", c_start);
		if (c_end == -1) c_end = c_value.length;
		c_value = unescape(c_value.substring(c_start,c_end));
	}
	return c_value;
}

function setCookie(c_name,value,exdays) {
	var exdate=new Date();
	exdate.setDate(exdate.getDate() + exdays);
	var c_value = escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
	document.cookie=c_name + "=" + c_value;
}

function checkCookie(c_name) {
	var c_value = getCookie(c_name);
	return (c_value != null && c_value != "");
}

function deleteCookie(c_name) {
	document.cookie=c_name + "=; expires=" + new Date(0).toUTCString();
}
