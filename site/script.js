///////////////////////
// Variables
///////////////////////
var color_red = "#F2DEDE", color_green = "#DFF0D8", color_yellow = "#FCF8E3";

///////////////////////
// Address to LatLong
///////////////////////
var geocoder;
var map;
function initialize() {
	geocoder = new google.maps.Geocoder();

	if (checkCookie("ir_state") && checkCookie("ir_district_House") && checkCookie("ir_district_Senate")) {
		element("locationMss").innerHTML = "Your residential region (but not your exact address) has been stored locally.<br /><br />";
		initWithLatLong();
		gotoSearchTab();
	} else {
		element("name").innerHTML = 'Please enter your location in the "Change Location" tab.';
	}
}

function currentLocation() {
	element("locationMss").innerHTML = "Your residential region (but not your exact address) has been stored locally.<br /><br />";
	initWithLatLong();
	gotoSearchTab();
}

function codeAddress() {
  var locStateElm = element("locState");
  if (locStateElm.value !== "NC") {
	alert("I'm sorry, the address lookup currenly only works in NC.");
	return;
  }
  element("state").value = locStateElm.value;

  var address = document.getElementById('locStreet').value+" "+document.getElementById('locCity').value+", "+document.getElementById('locState').value;
  var swBound = new google.maps.LatLng(33.840969, -84.32186899999999);
  var neBound = new google.maps.LatLng(36.5881568, -75.45995149999999);
  bounds =  new google.maps.LatLngBounds(swBound,neBound);
  
  geocoder.geocode( { 'address': address, 'bounds': bounds}, function(results, status) {
	if (status == google.maps.GeocoderStatus.OK) {
	  getLatLongLegislators(results[0].geometry.location.jb, results[0].geometry.location.kb);
	  gotoSearchTab();
	} else {
	  alert('Geocode was not successful for the following reason: ' + status);
	}
  });
}

google.maps.event.addDomListener(window, 'load', initialize);

///////////////////////
// Instarep Lookup
///////////////////////
function gotoSearchTab() {
	$('#tabs a[href="#search"]').tab("show");
}

function element(id) {
	return document.getElementById(id);
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function initWithLatLong() {
	if (navigator.geolocation) {
		element("name").innerHTML = "Loading...";
		
		navigator.geolocation.getCurrentPosition(function(pos) {
			var lat = pos.coords.latitude,
				long = pos.coords.longitude;
				
			// Get state
			if (checkCookie("ir_state") && checkCookie("ir_district_House") && checkCookie("ir_district_Senate")) {
				var c_state = getCookie("ir_state"),
					c_district_House = getCookie("ir_district_House"),
					c_district_Senate = getCookie("ir_district_Senate");
				
				// Have both state and district, use them to lookup
				getStateDistrictsLegislators(c_state, c_district_House, c_district_Senate);
				element("state").value = c_state;
				element("district_House").value = c_district_House;
				element("district_Senate").value = c_district_Senate;
			} else {
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
							alert("Failed to find the state from your latitude and longitude");
						}
					}
				});
				
				// Use latitude and longitude to find legislators
				getLatLongLegislators(lat, long);
			}
		});
	} else {
		element("name").innerHTML += "Geolocation is not supported by this browser.";
	}
}

function convertChamber(val) {
	if (val.chamber === "lower")
		val.chamber = "House";
	else if (val.chamber == "upper")
		val.chamber = "Senate";
}

function getLatLongLegislators(lat, long) {
	window.repsLoaded = false;
	clearInfo();
	element("name").innerHTML = "Loading...";
	element("reps").innerHTML = "";
	
	$.ajax({
		url: 'http://openstates.org/api/v1/legislators/geo/?lat=' + lat + '&long=' + long + '&active=true&apikey=18cdbb31b096462985cf408a5a41d3af',
		dataType: 'jsonp',
		success: function(json) {
			var lng = json.length, val = null,
				text = "";
				
			element("reps").innerHTML = "";
			if (lng <= 0) {
				element("name").innerHTML = "No representatives found.";
				return;
			}
				
			text += "<table border='1'><tr style='font-style: italic; background-color:" + color_yellow + ";'><td>Chamber</td><td>Party</td><td>Full Name</td><td>Email</td><td>Vote</td></tr>";
			for(var i=json.length-1; i>=0; i--) {
				val = json[i];
				
				if (!val.active)
					continue;
				else
					convertChamber(val);
				
				// For search
				element("reps").innerHTML += "<input type='hidden' id='rep" + i + "' value='" + json[i].leg_id + "'>";
				element("district_" + val.chamber).value = val.district;
				setCookie("ir_district_" + val.chamber, val.district, 365);
				
				// Display
				text += "<tr id='rep" + i + "_voteRow''><td>" + val.chamber + "</td><td>" + val.party + "</td><td>" + val.full_name + "</td><td>"
				text += "<a href='mailto:" + val.email + "'>" + val.email + "</a>";
				text += "</td><td id='rep" + i + "_vote'>N/A</td></tr>";
			}
			text += "</table>";
			
			// Display and tell of update reps
			element("name").innerHTML = text;
			window.repsLoaded = true;
			
			// Check for URL param
			var results = new RegExp("[\\?&]bill=([^&#]*)").exec(window.location.search);
			if (results != null) {
				element("bill_id").value = decodeURIComponent(results[1]);
				search();
			}
			
			updateCookies();
			clearInfo();
		},
		error: function() { window.alert("Error"); }
	});
}

function getStateDistrictsLegislators(state, house_district, senate_district) {
	window.repsLoaded = false;
	clearInfo();
	element("name").innerHTML = "Loading...";
	element("reps").innerHTML = "";
	var text = "<table border='1' cellpadding='5'><tr style='font-style: italic; background-color: " + color_yellow + ";'><td>Chamber</td><td>Party</td><td>Full Name</td><td>Email</td><td>Vote</td></tr>",
		upIt = 0, lowIt = 0;
	
	// House chamber (house)
	$.ajax({
		url: 'http://openstates.org/api/v1/legislators/?state=' + state + '&district=' + house_district + 
				'&active=true&chamber=lower&apikey=18cdbb31b096462985cf408a5a41d3af',
		dataType: 'jsonp',
		success: function(json) {
			var lng = json.length, val = null;
				
			for(lowIt=0; lowIt<lng; lowIt++) {
				val = json[lowIt];
				
				if (!val.active) continue;
				
				// For search
				element("reps").innerHTML += "<input type='hidden' id='rep" + (lowIt+upIt) + "' value='" + json[lowIt].leg_id + "'>";
				element("district_House").value = val.district;
				setCookie("ir_district_House", val.district, 365);
				
				// Display
				text += "<tr id='rep" + (lowIt+upIt) + "_voteRow'><td>House</td><td>" + val.party + "</td><td>" + val.full_name + "</td><td>"
				text += "<a href='mailto:" + val.email + "'>" + val.email + "</a>";
				text += "</td><td id='rep" + (lowIt+upIt) + "_vote'>N/A</td></tr>";
			}
			
			// Senate chamber (senate)
			$.ajax({
				url: 'http://openstates.org/api/v1/legislators/?state=' + state + '&district=' + senate_district + 
						'&active=true&chamber=upper&apikey=18cdbb31b096462985cf408a5a41d3af',
				dataType: 'jsonp',
				success: function(json) {
					var lng = json.length, val = null;
					
					for(upIt=0; upIt<lng; upIt++) {
						val = json[upIt];
						
						if (!val.active) continue;
						
						// For search
						element("reps").innerHTML += "<input type='hidden' id='rep" + (lowIt+upIt) + "' value='" + json[upIt].leg_id + "'>";
						element("district_Senate").value = val.district;
						setCookie("ir_district_Senate", val.district, 365);
						
						// Display
						text += "<tr id='rep" + (lowIt+upIt) + "_voteRow'><td>Senate</td><td>" + val.party + "</td><td>" + val.full_name + "</td><td>"
						text += "<a href='mailto:" + val.email + "'>" + val.email + "</a>";
						text += "</td><td id='rep" + (lowIt+upIt) + "_vote'>N/A</td></tr>";
					}
					text += "</table>";
					
					// Display and tell of update reps
					element("name").innerHTML = text;
					window.repsLoaded = true;
					
					// Check for URL param
					var results = new RegExp("[\\?&]bill=([^&#]*)").exec(window.location.search);
					if (results != null) {
						element("bill_id").value = decodeURIComponent(results[1]);
						search();
					}
					
					updateCookies();
					clearInfo();
				},
				error: function() { window.alert("Error"); }
			});
		},
		error: function() { window.alert("Error"); }
	});
}

function clearInfo() {
	var docReps = document.getElementsByName("reps")[0].childNodes, lng = docReps.length, reps = new Array(lng);
	for (var i=0; i<lng; i++) {
		var cellElmnt = element(docReps[i].id + "_vote");
		if (cellElmnt !== null)
			cellElmnt.innerHTML = "N/A";
			
		// Set default row background color
		var rowElmnt = element(docReps[i].id + "_voteRow");
		if (rowElmnt !== null)
			rowElmnt.bgColor = "white";
	}
	
	element("bill_desc").innerHTML = "";
	element("other_bills").innerHTML = "";
}

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
	if (locChange) getStateDistrictsLegislators(state, district_House, district_Senate);
}

// Called to display the bill
//   jsonBillId: The bill index of the json to display in detail
function displayBills(jsonBillId) {
	// Clear the info from the previous bill
	clearInfo();

	if (window.lastSearchJson.length > 1) {
		element("other_bills").innerHTML = "<p><h6>Other matching bills:</h6><ul>";
		for (var i=0; i<window.lastSearchJson.length - 1; i++) {
			if (i == jsonBillId) {
				element("other_bills").innerHTML += "<li><a href='javascript:displayBills(" + i + ");'><b>" + window.lastSearchJson[i].title + "</b></a></li>";
			} else {
				element("other_bills").innerHTML += "<li><a href='javascript:displayBills(" + i + ");'>" + window.lastSearchJson[i].title + "</a></li>";
			}
		}
	}
	
	tableJson = window.lastSearchJson[jsonBillId];
	// No vote yet
	if (tableJson.votes.length <= 0) {
		element("bill_desc").innerHTML = "<b>No votes</b> on <i>" + tableJson.title + " (" + tableJson.bill_id + ")</i>.";
		printSources(tableJson.sources);
		return true;
	} else {
		// Convert from house/senate to house/senate
		convertChamber(tableJson);
	
		var mss = "Latest vote on <i>" + tableJson.title + " (" + tableJson.bill_id + ")</i> of the " + tableJson.chamber + ". <br />"
		element("bill_desc").innerHTML = mss
		printSources(tableJson.sources);
	}

	// Read votes
	var votes = tableJson.votes[tableJson.votes.length-1],
		yes_votes = votes.yes_votes, yes_count = yes_votes.length,
		no_votes = votes.no_votes, no_count = no_votes.length,
		other_votes = votes.other_votes, other_count = other_votes.length;
	
	// Read representatives
	var docReps = document.getElementsByName("reps")[0].childNodes, lng = docReps.length, reps = new Array(lng);
	for (var i=0; i<lng; i++) {
		reps[i] = { voteCellId: docReps[i].id + "_vote", voteRowId: docReps[i].id + "_voteRow", leg_id: docReps[i].value };
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
	
	// Print the sources of the result
	function printSources(sources) {
		if (sources.length <= 0) return;

		var mss = "<h6> Sources: <br />";
			
		for (var i=0; i<sources.length; i++) {
			mss += "<a target='_blank' href='" + sources[i].url + "'>" + sources[i].url.match(/\/\/(.+?)\//)[1] + "</a> <br />";
		}
		mss += "</h6>";
		
		element("sources").innerHTML = mss
	}
}

function search() {
	if (window.repsLoaded !== true) {
		element("bill_desc").innerHTML = "Still trying to load your local representatives";
		return;
	}

	clearInfo();
	
	var bill_id = element("bill_id").value,
		state = element("state").value.toUpperCase();
		
	// Update state and district cookies if different
	updateCookies();
	
	// Create the search string
	var searchStr = "http://openstates.org/api/v1/bills/?state=" + state + "&search_window=session&q=" + bill_id + "&fields=votes,votes.yes_votes,votes.no_votes,votes.other_votes,title,bill_id,chamber,sources&apikey=18cdbb31b096462985cf408a5a41d3af";
	
	element("bill_desc").innerHTML = "Loading <i>" + bill_id + "</i>...";
	
	// Remove old timer and add a new one
	if (window.submitTimer != null) window.clearTimeout(window.submitTimer);
	window.submitTimer = window.setTimeout(submitTimeout, 5000);
	
	$.ajax({
		url: searchStr,
		dataType: 'jsonp',
		success: function(json) {
			var lng = json.length, tableJson;
			if (lng <= 0) {
				element("bill_desc").innerHTML = "No bill found with the search '" + bill_id + "'.";
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
				return;
			} else {
				window.clearTimeout(window.submitTimer);
				window.lastSearchJson = json;
				
				// First first bill is the most recent
				return displayBills(0);
			}
		},
		error: function() { window.alert("Error"); }
	});
	
	function submitTimeout() {
		element("bill_desc").innerHTML = "Load bill timed out. Are you sure you entered a valid bill?";
	}
}

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