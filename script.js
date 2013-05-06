function element(id) {
	return document.getElementById(id);
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function getLatLon() {
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(init);
	} else {
		element("name").innerHTML += "Geolocation is not supported by this browser.";
	}
}

function init(pos) {
	var lat = pos.coords.latitude,
		long = pos.coords.longitude;
		
	// Get state
	if (checkCookie("ir_state") && checkCookie("ir_district_lower") && checkCookie("ir_district_upper")) {
		var c_state = getCookie("ir_state"),
			c_district_lower = getCookie("ir_district_lower"),
			c_district_upper = getCookie("ir_district_upper");
		
		// Have both state and district, use them to lookup
		getStateDistrictsLegislators(c_state, c_district_lower, c_district_upper);
		element("state").value = c_state;
		element("district_lower").value = c_district_lower;
		element("district_upper").value = c_district_upper;
	} else {
		$.ajax({
			url: 'http://maps.googleapis.com/maps/api/geocode/json?latlng=' + lat + ',' + long + '&sensor=false',
			dataType: 'json',
			success: function(json) {
				var addrs = json.results[0].address_components, lng = addrs.length;
				for (var i=0; i<lng; i++) {
					if (addrs[i].types[0] === "administrative_area_level_1") {
						setCookie("ir_state", addrs[i].short_name, 365);
						element("state").value = addrs[i].short_name;
						break;
					}
				}			
			}
		});
		
		// Use latitude and longitude to find legislators
		getLatLongLegislators(lat, long);
	}
}


function getLatLongLegislators(lat, long) {
	window.repsLoaded = false;
	element("name").innerHTML = "Loading...";
	
	$.ajax({
		url: 'http://openstates.org/api/v1/legislators/geo/?lat=' + lat + '&long=' + long + '&active=true&apikey=18cdbb31b096462985cf408a5a41d3af',
		dataType: 'jsonp',
		success: function(json) {
			var lng = json.length, val = null,
				text = "";
				
			element("reps").innerHTML = "";
			if (lng <= 0) {
				element("name").innerHTML = "No representatives found. Are the state and district values entered valid?";
				return;
			}
				
			text += "<table border='1'><tr style='font-style: italic'><td>Chamber</td><td>Party</td><td>Full Name</td><td>Email</td><td>Vote</td></tr>";
			for(var i=0; i<lng; i++) {
				val = json[i];
				
				if (!val.active) continue;
				
				// For search
				element("reps").innerHTML += "<input type='hidden' id='rep" + i + "' value='" + json[i].leg_id + "'>";
				element("district_" + val.chamber).value = val.district;
				setCookie("ir_district_" + val.chamber, val.district, 365);
				
				// Display
				text += "<tr><td>" + val.chamber + "</td><td>" + val.party + "</td><td>" + val.full_name + "</td><td>"
				if (val.offices.length > 0 && val.offices[0].email != null) {
					text += "<a href='mailto:" + val.offices[0].email + "'>" + val.offices[0].email + "</a>";
				} else text += "None";
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
				submit();
			}
		},
		error: function() { window.alert("Error"); }
	});
}

function getStateDistrictsLegislators(state, lower_district, upper_district) {
	window.repsLoaded = false;
	element("name").innerHTML = "Loading...";
	element("reps").innerHTML = "";
	var text = "<table border='1'><tr style='font-style: italic'><td>Chamber</td><td>Party</td><td>Full Name</td><td>Email</td><td>Vote</td></tr>",
		upIt = 0, lowIt = 0;
	
	// Lower chamber (house)
	$.ajax({
		url: 'http://openstates.org/api/v1/legislators/?state=' + state + '&district=' + lower_district + 
				'&active=true&chamber=lower&apikey=18cdbb31b096462985cf408a5a41d3af',
		dataType: 'jsonp',
		success: function(json) {
			var lng = json.length, val = null;
				
			for(lowIt=0; lowIt<lng; lowIt++) {
				val = json[lowIt];
				
				if (!val.active) continue;
				
				// For search
				element("reps").innerHTML += "<input type='hidden' id='rep" + (lowIt+upIt) + "' value='" + json[lowIt].leg_id + "'>";
				element("district_lower").value = val.district;
				setCookie("ir_district_lower", val.district, 365);
				
				// Display
				text += "<tr><td>Lower</td><td>" + val.party + "</td><td>" + val.full_name + "</td><td>"
				if (val.offices.length > 0 && val.offices[0].email != null) {
					text += "<a href='mailto:" + val.offices[0].email + "'>" + val.offices[0].email + "</a>";
				} else text += "None";
				text += "</td><td id='rep" + (lowIt+upIt) + "_vote'>N/A</td></tr>";
			}
			
			// Upper chamber (senate)
			$.ajax({
				url: 'http://openstates.org/api/v1/legislators/?state=' + state + '&district=' + upper_district + 
						'&active=true&chamber=upper&apikey=18cdbb31b096462985cf408a5a41d3af',
				dataType: 'jsonp',
				success: function(json) {
					var lng = json.length, val = null;
					
					for(upIt=0; upIt<lng; upIt++) {
						val = json[upIt];
						
						if (!val.active) continue;
						
						// For search
						element("reps").innerHTML += "<input type='hidden' id='rep" + (lowIt+upIt) + "' value='" + json[upIt].leg_id + "'>";
						element("district_upper").value = val.district;
						setCookie("ir_district_upper", val.district, 365);
						
						// Display
						text += "<tr><td>Upper</td><td>" + val.party + "</td><td>" + val.full_name + "</td><td>"
						if (val.offices.length > 0 && val.offices[0].email != null) {
							text += "<a href='mailto:" + val.offices[0].email + "'>" + val.offices[0].email + "</a>";
						} else text += "None";
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
						submit();
					}
				},
				error: function() { window.alert("Error"); }
			});
		},
		error: function() { window.alert("Error"); }
	});
}

function submit() {
	if (window.repsLoaded !== true) {
		element("bill_desc").innerHTML = "Still trying to load your local representatives";
		return;
	}

	var docReps = document.getElementsByName("reps")[0].childNodes, lng = docReps.length, reps = new Array(lng);
	for (var i=0; i<lng; i++) {
		element(docReps[i].id + "_vote").innerHTML = "N/A";
	}
	
	var bill_id = element("bill_id").value,
		split_bill = (bill_id.trim().match(/([a-zA-Z]+|\s+|\d+)/g) || []),
		year = (new Date()).getFullYear(),
		state = element("state").value.toUpperCase(),
		district_lower = element("district_lower").value.toUpperCase(),
		district_upper = element("district_upper").value.toUpperCase();
		
	// Update state and district cookies if different
	var locChange = false;
	if (getCookie("ir_state") != state) {
		setCookie("ir_state", state, 365);
		locChange = true;
	}
	if (getCookie("ir_district_lower") != district_lower) {
		setCookie("ir_district_lower", district_lower, 365);
		locChange = true;
	}
	if (getCookie("ir_district_upper") != district_upper) {
		setCookie("ir_district_upper", district_upper, 365);
		locChange = true;
	}
	if (locChange) getStateDistrictsLegislators(state, district_lower, district_upper);
		
	// Format the bill id
	if (split_bill.length == 2 && split_bill[0].search(/^[a-zA-Z]+/) == 0 && split_bill[1].search(/^\d+/) == 0)
		bill_id = (split_bill[0] + " " + split_bill[1]).toUpperCase();
	else if (split_bill.length == 3 && split_bill[0].search(/^[a-zA-Z]+/) == 0 && split_bill[1].search(/^\s+/) == 0 && split_bill[2].search(/^\d+/) == 0)
		bill_id = (split_bill[0] + " " + split_bill[2]).toUpperCase();
	else {
		element("bill_desc").innerHTML = "Invalid Bill Id \"<i>" + bill_id + "</i>\"";
		return;
	}
	
	// Create the search string
	var searchStr = "http://openstates.org/api/v1/bills/" + state + "/" + year + "/" + bill_id + "/?apikey=18cdbb31b096462985cf408a5a41d3af";
	
	element("bill_desc").innerHTML = "Loading <i>" + bill_id + "</i>...";
	
	// Remove old timer and add a new one
	if (window.submitTimer != null) window.clearTimeout(window.submitTimer);
	window.submitTimer = window.setTimeout(submitTimeout, 5000);
	
	$.ajax({
		url: searchStr,
		dataType: 'jsonp',
		success: function(json) {
			window.clearTimeout(window.submitTimer);
		
			// No vote yet
			if (json.votes.length <= 0) {
				element("bill_desc").innerHTML = "No votes on <i>" + json.title + " (" + json.bill_id + ")</i>.";
				printSources(json.sources);
				return true;
			} else {
				var mss = "Latest vote on <i>" + json.title + " (" + json.bill_id + ")</i> of the " + json.chamber + " chamber. <br />"
				element("bill_desc").innerHTML = mss
				printSources(json.sources);
			}
		
			// Read votes
			var votes = json.votes[json.votes.length-1],
				yes_votes = votes.yes_votes, yes_count = yes_votes.length,
				no_votes = votes.no_votes, no_count = no_votes.length,
				other_votes = votes.other_votes, other_count = other_votes.length;
			
			// Read representatives
			var docReps = document.getElementsByName("reps")[0].childNodes, lng = docReps.length, reps = new Array(lng);
			for (var i=0; i<lng; i++) {
				reps[i] = { voteDocId: docReps[i].id + "_vote", leg_id: docReps[i].value };
			}
			
			// Find representative's vote
			var i, j, r, found;
			for (i=0; i<lng; i++) {
				found = false;
				r = reps[i];
				for (j=0; j<yes_count; j++) {
					if (yes_votes[j].leg_id == r.leg_id) {
						element(r.voteDocId).innerHTML = "Yes";
						found = true;
						break;
					}
				}
				if (found) continue; // No need to do other loops
				
				for (j=0; j<no_count; j++) {
					if (no_votes[j].leg_id == r.leg_id) {
						element(r.voteDocId).innerHTML = "No";
						found = true;
						break;
					}
				}
				if (found) continue; // No need to do last loop
				
				for (j=0; j<other_count; j++) {
					if (other_votes[j].leg_id == r.leg_id) {
						element(r.voteDocId).innerHTML = "Absent";
						break;
					}
				}
			}
		},
		error: function() { window.alert("Error"); }
	});
	
	function submitTimeout() {
		element("bill_desc").innerHTML = "Load bill timed out. Are you sure you entered a valid bill?";
	}
	
	function printSources(sources) {
		if (sources.length <= 0) return;

		var mss = "<h6> Sources: <br />";
			
		for (var i=0; i<sources.length; i++) {
			mss += "<a target='_blank' href='" + sources[i].url + "'>Source " + i + "</a> <br />";
		}
		mss += "</h6>";
		
		element("bill_desc").innerHTML += mss
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