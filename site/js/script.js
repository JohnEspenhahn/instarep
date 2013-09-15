///////////////////////
// Variables
///////////////////////
var color_red = "#F2DEDE", color_green = "#DFF0D8", color_yellow = "#FCF8E3";

///////////////////////
// Address to LatLong
///////////////////////

function init() {
	window.ir = {};
    window.ir.docReps = [];

	if (checkCookie("ir_state") && checkCookie("ir_district_house") && checkCookie("ir_district_senate")) {
		locationSavedMessage();
		getLegislatorFromStateAndDistricts(getCookie("ir_state"), getCookie("ir_district_house"), getCookie("ir_district_senate"));
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
	var street = element("locStreet").value,
	  city = element("locCity").value,
	  state = element("locState").value.toUpperCase();
	  
	if (google == undefined) {
		element("locationMss").innerHTML = "<span class='error'>Failed to connect to google, try refreshing the page.</span>";
	} else if (state == "") {
		element("locationMss").innerHTML = "<span class='error'>Please provide your state or choose 'Use Current Location':</span>";
	} else if (city == "") {
		element("locationMss").innerHTML = "<span class='error'>Please provide your city or choose 'Use Current Location':</span>";
	} else if (street == "") {
		element("locationMss").innerHTML = "<span class='error'>Please provide your street or choose 'Use Current Location':</span>";
	} else {
		var geocoder = new google.maps.Geocoder(),
		  address = street+" "+city+", "+state,
		  swBound = new google.maps.LatLng(22.350076,-63.294983),
		  neBound = new google.maps.LatLng(73.124945,169.398193),
		  bounds =  new google.maps.LatLngBounds(swBound,neBound);

		geocoder.geocode( { 'address': address, 'bounds': bounds}, function(results, status) {
			if (status == google.maps.GeocoderStatus.OK) {
				clearCookies();
				
				window.ir.state = state;
				setCookie("ir_state", state, 365);
				getLegislatorsFromLatLong(results[0].geometry.location.lat(), results[0].geometry.location.lng());
				
				gotoSearchTab();
			} else {
				window.alert('Geocode was not successful for the following reason: ' + status);
			}
		});
	}
}

function clearCookies() {
	deleteCookie("ir_state");
	deleteCookie("ir_district_house");
	deleteCookie("ir_district_senate");
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
	element("locationMss").innerHTML = "Your district has been stored locally.";
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
			if (checkCookie("ir_state") && checkCookie("ir_district_house") && checkCookie("ir_district_senate")) {
				var c_state = getCookie("ir_state"),
					c_district_house = getCookie("ir_district_house"),
					c_district_senate = getCookie("ir_district_senate");

				// Have both state and district, use them to lookup
				getLegislatorFromStateAndDistricts(c_state, c_district_house, c_district_senate);
				window.ir.state = c_state;
				window.ir.district_house = c_district_house;
				window.ir.district_senate = c_district_senate;
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
					setCookie("ir_state", addrs[i].short_name.toUpperCase(), 365);
					window.ir.state = addrs[i].short_name;
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
	window.ir.repsLoaded = false;
	clearInfo();
	window.ir.docReps = [];

	ajaxOpenStatesGetLegislatorsFromLatLong(lat, long);
}

// Run an ajax query to open states to get the legislators for the given latitude and longitude
function ajaxOpenStatesGetLegislatorsFromLatLong(lat, long) {
	$.ajax({
		url: 'http://openstates.org/api/v1/legislators/geo/?lat=' + lat + '&long=' + long + '&active=true&apikey=18cdbb31b096462985cf408a5a41d3af',
		dataType: 'jsonp',
		success: function(json) {
			var lng = json.length, val = null;
			
			window.ir.docReps = [];
			if (lng <= 0) {
				element("name").innerHTML = "No representatives found.";
				return;
			}
			
			element("name").innerHTML = "<table id='legInfo' border='1' cellpadding='5'><thead><tr style='font-style: italic; background-color: " + color_yellow + ";'><th>Chamber</th><th>Party</th><th>Name</th><th>Email</th><th>Vote</th></tr></thead><tbody id='legInfoBody'></tbody></table>";

			for(var i=json.length-1; i>=0; i--) {
				val = json[i];

				if (!val.active) {
					continue;
				} else {
					convertChamber(val);
				}

				// For search
				window.ir.docReps.push({ voteCellId: val.leg_id + "_vote", voteRowId: val.leg_id + "_voteRow", leg_id: val.leg_id });
				if (val.chamber === "House") {
					window.ir.districthouse = val.district;
					setCookie("ir_district_house", val.district, 365);
				} else {
					window.ir.districtsenate = val.district;
					setCookie("ir_district_senate", val.district, 365);
				}

				displayLegislator(val);
			}

			checkDoneLoading();
		},
		error: function() { window.alert("Error connecting to Open States API."); }
	});
}

// Use the state and districts to search from their legislator
function getLegislatorFromStateAndDistricts(state, house_district, senate_district) {
	window.ir.repsLoaded = false;
	clearInfo();
	window.ir.docReps = [];
	element("name").innerHTML = "<table id='legInfo' border='1' cellpadding='5'><thead><tr style='font-style: italic; background-color: " + color_yellow + ";'><th>Chamber</th><th>Party</th><th>Name</th><th>Email</th><th>Vote</th></tr></thead><tbody id='legInfoBody'></tbody></table>";

	setCookie("ir_state", state, 365);
	window.ir.state = state;

	// house chamber (house)
	ajaxOpenStatesGethouse(state, house_district);

	// senate chamber (senate)
	ajaxOpenStatesGetsenate(state, senate_district);
}

// Get the congressman from the current state and district
function ajaxOpenStatesGethouse(state, house_district) {
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
				window.ir.docReps.push({ voteCellId: val.leg_id + "_vote", voteRowId: val.leg_id + "_voteRow", leg_id: val.leg_id });
				window.ir.districthouse = val.district;
				setCookie("ir_district_house", val.district, 365);

				displayLegislator(val);
			}

			checkDoneLoading();
		},
		error: function() { window.alert("Error connecting to Open States API."); }
	});
}

// Get the senator from the current state and district
function ajaxOpenStatesGetsenate(state, senate_district) {
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
				window.ir.docReps.push({ voteCellId: val.leg_id + "_vote", voteRowId: val.leg_id + "_voteRow", leg_id: val.leg_id });
				window.ir.districtsenate = val.district;
				setCookie("ir_district_senate", val.district, 365);

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
	window.ir.repsLoaded = true;
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
	if (val.email == null) {
		val.email = "";
	}
	
	// Display
	var row = element("legInfoBody").insertRow(-1);
	row.id = val.leg_id + "_voteRow";
	row.innerHTML = "<td>" + val.chamber + "</td><td>" + val.party + "</td><td>" + val.full_name + "</td>" +
		"<td><pre><a href='mailto:" + val.email + "'>" + val.email + "</a></td><td id='" + val.leg_id + "_vote'>N/A</pre></td></tr>";
}

function clearInfo() {
	element("other_bills").innerHTML = "";
	clearOldBill();
}

// Clear the info from the previous bill
function clearOldBill() {
	element("sources").innerHTML = "";
	element("bill_desc").innerHTML = "";

	var docReps = window.ir.docReps;
	for (var i=0; i<docReps.length; i++) {
		var cellElmnt = element(docReps[i].voteCellId);
		if (cellElmnt != null)
			cellElmnt.innerHTML = "N/A";

		// Set default row background color
		var rowElmnt = element(docReps[i].voteRowId);
		if (rowElmnt != null)
			rowElmnt.bgColor = "white";
	}
}

// Update the cookies with the latest info
function updateCookies() {
	var locChange = false,
		state = window.ir.state.toUpperCase(),
		district_house = window.ir.districthouse,
		district_senate = window.ir.districtsenate;

	if (getCookie("ir_state") != state) {
		setCookie("ir_state", state, 365);
		locChange = true;
	}
	if (getCookie("ir_district_house") != district_house) {
		setCookie("ir_district_house", district_house, 365);
		locChange = true;
	}
	if (getCookie("ir_district_senate") != district_senate) {
		setCookie("ir_district_senate", district_senate, 365);
		locChange = true;
	}
	
	if (locChange) {
		getLegislatorFromStateAndDistricts(state, district_house, district_senate);
	}
}

function search() {
	if (window.ir.repsLoaded !== true) {
		element("bill_desc").innerHTML = "Still trying to load your local representatives";
		return;
	} else if (window.ir.searchingBill) {
		element("bill_desc").innerHTML = "Loading <i>" + window.ir.searchingBill + "</i> already...";
		return;
	}

	window.ir.searchingBill = formatBill(element("bill_id").value);
	clearInfo();

	// Update state and district cookies if different
	updateCookies();

	element("bill_desc").innerHTML = "Loading <i>" + window.ir.searchingBill + "</i>...";

	// Remove old timer and add a new one
	createNewTimeout(function() { 
			window.ir.searchingBill = undefined;
			element("bill_desc").innerHTML = "Load bill timed out. Are you sure you entered a valid bill?";
		}, 10000);

	// Submit the search string to open states
	var state = window.ir.state.toUpperCase();
	ajaxOpenStatesGetBill(state, window.ir.searchingBill);
}

function ajaxOpenStatesGetBill(state, bill_id) {
	$.ajax({
		url: "http://openstates.org/api/v1/bills/?state=" + state + "&q=" + bill_id + "&search_window=session&page=1" +
					"&fields=actions.type,actions.date,votes.date,votes.yes_votes,votes.no_votes,votes.other_votes,title,bill_id,chamber,sources&apikey=18cdbb31b096462985cf408a5a41d3af",
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
				window.ir.lastSearchJson = json;
				
				displayBills(0);
			}
			
			window.ir.searchingBill = "";
		},
		error: function() { 
			window.ir.searchingBill = "";
			window.alert("Error connecting to Open States API."); 
		}
	});
}

// Called to display the bill
//   jsonBillId: The bill index of the json to display in detail
function displayBills(jsonBillId) {
	if (window.ir.lastSearchJson.length > 1) {
		element("other_bills").innerHTML = "<p><h6>Other matching bills:</h6><ul>";
		
		var len = window.ir.lastSearchJson.length - 1;
		for (var i=0; i<len; i++) {
			element("other_bills").innerHTML += "<li><a id='linkbill_" + i + "' href='javascript:switchToBill(" + i + ");'>" + window.ir.lastSearchJson[i].title + "</a></li>";
		}
	}
	
	window.ir.lastBillId = jsonBillId;
	switchToBill(jsonBillId);
}

function switchToBill(jsonBillId) {
	var oldBill = element("linkbill_" + window.ir.lastBillId);
	if (oldBill != null)
		oldBill.style.fontWeight = "normal";

	window.ir.lastBillId = jsonBillId;
	
	var newBill = element("linkbill_" + window.ir.lastBillId);
	if (newBill != null)
		newBill.style.fontWeight = "bold";

	clearOldBill();
	$(document).scrollTop($("#info_anchor").offset().top);

	tableJson = window.ir.lastSearchJson[jsonBillId];
	// No vote yet
	if (tableJson.votes.length <= 0) {
		element("bill_desc").innerHTML = "<b>No votes</b> on <i>" + tableJson.title + " (" + tableJson.bill_id + ")</i>.";
		displaySources(tableJson.sources);
	} else {
		// Convert from house/senate to house/senate
		convertChamber(tableJson);

		element("bill_desc").innerHTML = "Latest vote on <i>" + tableJson.title + " (" + tableJson.bill_id + ")</i> of the " + tableJson.chamber + ". <br />";
		displayVotes(tableJson);
		displaySources(tableJson.sources);
	}
}

// Display the vote for each representative
function displayVotes(tableJson) {
	var actionDates = [];
	tableJson.actions.forEach(function(action) {
		action.type.forEach(function(actType) {
			if (actType === "bill:passed" || actType === "bill:failed") {
				var actionDate = action.date.split(' ')[0];
				actionDates.push(actionDate);
			} else {
				console.log(actType);
			}
		});
	});

	tableJson.votes.forEach(function(vote) {
		// Check that this is a bill we care about
		var voteDate = vote.date.split(' ')[0];
		if ($.inArray(voteDate, actionDates) === -1)
			return;
	
		// Find representative's vote
		for (var i=0; i<window.ir.docReps.length; i++) {
			if (checkVoteForRep(window.ir.docReps[i], vote.yes_votes, vote.no_votes, vote.other_votes))
				break;
		}
	});
}

function checkVoteForRep(repObj, yes_votes, no_votes, other_votes) {
	for (var j=0; j<yes_votes.length; j++) {
		if (yes_votes[j].leg_id === repObj.leg_id) {
			element(repObj.voteCellId).innerHTML = "Yes";
			element(repObj.voteRowId).bgColor = color_green;
			return true;
		}
	}

	for (var j=0; j<no_votes.length; j++) {
		if (no_votes[j].leg_id === repObj.leg_id) {
			element(repObj.voteCellId).innerHTML = "No";
			element(repObj.voteRowId).bgColor = color_red;
			return true;
		}
	}

	for (var j=0; j<other_votes.length; j++) {
		if (other_votes[j].leg_id === repObj.leg_id) {
			element(repObj.voteCellId).innerHTML = "Absent";
			element(repObj.voteRowId).bgColor = "white";
			return true;
		}
	}
	
	return false
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
