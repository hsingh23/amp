var currentUser = '';
var volume;
var stateTimer;
var templates = {};
var jsonSource = 'json.pl';
var playingTimer;
var elapsedTime = 0;
var totalTime = 0;

$(document).ready(function() {
	$("#queue-list").sortable({
		placeholder: "queue-song-placeholder",
		axis: "y",
		handle: ".queue-song-handle",
		update: updateQueueOrder
	});

	// templating
	templates.queueSong = $("li.queue-song").first().clone();
	templates.nowPlayingPanel = $("#now-playing-panel").clone();

	playerStateRequest();
	if (stateTimer) clearInterval(stateTimer);
	stateTimer = setInterval(function() {playerStateRequest();}, 15000)
	$("#search-results-table").tablesorter();
});

function readableTime(length) {
	if (length < 0) {length = 0;}
	var seconds = length % 60;
	var minutes = Math.floor(length / 60) % 60;
	var hours = Math.floor(length / 3600);
	if (hours) {
		return sprintf("%d:%02d:%02d",hours,minutes,seconds);
	} else {
		return sprintf("%d:%02d",minutes,seconds);
	}
}

function startPlayingTimer() {
	if (playingTimer) clearInterval(playingTimer);
	playingTimer = setInterval(function() { updatePlayingTime() }, 1000);
}

function updatePlayingTime() {
	if (elapsedTime < totalTime) {
		$('#now-playing-time').html(readableTime(++elapsedTime));
		$('#now-playing-progress').progressbar({value: Math.floor(100 * (elapsedTime/totalTime))});
	} else if (elapsedTime >= totalTime) {
		playerStateRequest();
	}
}

function playerStateRequest() {
	$.getJSON(
		jsonSource,
		function (json) {handlePlayerStateRequest(json);}
	);
}

function doSearch(field, value) {
	$("#search-results-status").html("Searching for '" + value + "'...");
	$.getJSON(jsonSource + "?mode=search;field=" + field + ";value=" + value,
		function (data) {
			$("#search-results-status").html("Processing " + data.length + " results.");
			if (data.length > 1000) {
				if (!confirm("Your search returned a lot of results (" + data.length +"). Do you still want to continue?")) {
					return false;
				}
			}
			fillResultTable(data);
			$("#search-results-status").html("Search results for '" + value + "'.");
	});
	return false;
}

function selectRequest(field, value) {
	$("#search-results-status").html("Searching for '" + value + "'...");
	$.getJSON(jsonSource + "?mode=select;field=" + field + ";value=" + value,
		function (data) {
			$("#search-results-status").html("Processing " + data.length + " results.");
			fillResultTable(data);
			$("#search-results-status").html("Songs where " + field + " is '"
				+ value + "'.");
	});
}

function loadRandomSongs(amount, seed) {
	$.getJSON(
		jsonSource + "?mode=random;amount=" + amount + ";seed=" + seed,
		function (data) {
			$('#search-results-random a').attr('href',
				'#RandomSongs/20/' + (new Date()).getTime());
			fillResultTable(data);
			$("#search-results-status").html(amount + " Random Songs");
		}
	);
}

function loadRecentSongs(amount) {
	$.getJSON(
		jsonSource + '?mode=recent;amount=' + amount,
		function (data) {
			fillResultTable(data);
			$("#search-results-status").html(amount + " Recently Added Songs");
		}
	);
}

function loadPlayHistory(amount, who) {
	$.getJSON(
		jsonSource + '?mode=history;amount=' + amount + ";who=" + who,
		function (data) {
			fillResultTable(data);
			var bywho = "";
			if (who) bywho = " By " + who;
			$("#search-results-status").html(amount + " Recently Played Songs"
				+ bywho);
		}
	);
}

function fillResultTable(json) {
	$("#search-results-table tbody").html(" ");
	if (json.length < 1) {
		$("#search-results-table tbody").append("<tr><td colspan=\"6\"><center><i>No results.</i></center></td></tr>");
		$("#search-results-time").html("0 seconds");
		$("#search-results-count").html("0 songs");
		return false;
	}
	var total_length = 0;
	for (i in json) {
		var song = json[i];
		// TODO: template me
		$("#search-results-table tbody").append(
			"<tr><td><a href=\"javascript:voteSong(" + song.song_id +
			")\">+</a></td><td>" + song.track +
			"</td><td><a href='#SelectRequest/title/" + uriencode(song.title) +
			"'>" + song.title + "</a></td><td><a href='#SelectRequest/album/" +
			uriencode(song.album) + "'>" + song.album +
			"</a></td><td><a href='#SelectRequest/artist/" +
			uriencode(song.artist) + "'>" + song.artist + "</td><td>"
			+ readableTime(song.length) + "</td></tr>\n");
		total_length += parseInt(song.length);
	}
	$("#search-results-table").tablesorter({widgets: ['zebra']});
	$("#search-results-time").html(readableTime(total_length));
	if (json.length == 1) {
		$("#search-results-count").html("One song");
	} else {
		$("#search-results-count").html(json.length +" songs");
	}
}

function updateQueueOrder(event, ui) {
	// Do something here.
	$("#search-results-status").html("The queue was reordered.");
}

function voteSong(song_id) {
	$.getJSON(
		jsonSource + '?mode=vote;song_id=' + song_id,
		function (data) {handlePlayerStateRequest(data);}
	);
}

function unvoteSong(song_id) {
	$.getJSON(
		jsonSource + '?mode=unvote;song_id=' + song_id,
		function (data) {handlePlayerStateRequest(data);}
	);
}

function handlePlayerStateRequest(json) {
	// volume
	if (json.player && json.player.volume != undefined) {
		volume = parseInt(json.player.volume);
		$("#controls-volume").html((volume / 10) + 1);
	} else {
		$("#controls-volume").html("-");
	}

	// user
	if (json.who) {
		$("#header-bar-user-message").html("logged in as");
		$("#user-name").html(json.who);
		currentUser = json.who;
	}

	// now playing
	var nowPlaying = json.now_playing;
	var nowPlayingPanel = templates.nowPlayingPanel.clone();
	$("#now-playing-panel").empty();
	if (nowPlaying) {
		$("#now-playing-title", nowPlayingPanel).html(nowPlaying.title);
		$("#now-playing-album", nowPlayingPanel).html(nowPlaying.album);
		$("#now-playing-artist", nowPlayingPanel).html(nowPlaying.artist);
		$("#now-playing-total", nowPlayingPanel).html(readableTime(nowPlaying.length));
		totalTime = nowPlaying.length;
		startPlayingTimer();
		elapsedTime = Math.round(((new Date().getTime())/1000)) - json.player.song_start;
		$("#now-playing-time", nowPlayingPanel).html(readableTime(elapsedTime));
		$("#nothing-playing-info", nowPlayingPanel).remove();
		$("#now-playing-panel").replaceWith(nowPlayingPanel);
		$("#now-playing-album-art-img").reflect({height: 16});
		$("#now-playing-progress").progressbar({value: Math.floor(100 * (elapsedTime/totalTime))});
	} else {
		$("#now-playing-album-art", nowPlayingPanel).remove();
		$("#now-playing-info", nowPlayingPanel).remove();
		$("#now-playing-panel").replaceWith(nowPlayingPanel);
		totalTime = -1;
	}

	// the queue
	$("#queue-list").empty();
	var total_length = 0;
	for (var i in json.playlist) {
		var song = json.playlist[i];
		var entry = templates.queueSong.clone();
		$(".queue-song-id", entry).html(song.song_id);
		$(".queue-song-title", entry).html(song.title);
		$(".queue-song-artist", entry).html(song.artist);
		$(".queue-song-time", entry).html(readableTime(song.length));
		if (_.indexOf(song.who, currentUser) != -1) {
			$(".queue-song-vote-link", entry).remove();
			$(".queue-song-unvote-link", entry).attr("href",
					"javascript:unvoteSong("+ song.song_id +")");
		} else {
			$(".queue-song-vote-link", entry).attr("href",
					"javascript:voteSong("+ song.song_id +")");
			$(".queue-song-unvote-link", entry).remove();
		}
		$(".queue-song-vote-count", entry).html(song.who.length);
		total_length += parseInt(song.length);
		entry.appendTo("#queue-list");
	}
	var length = $("#queue-list").contents().length;
	if (length == 1) {
		$("#queue-song-count").html("One song");
	} else {
		$("#queue-song-count").html(length + " songs");
	}
	$("#queue-length").html(readableTime(total_length));
}

function login() {
	$.get(
		'www-data/auth',
		function () {playerStateRequest();}
	);
}

function controlPlayPause() {
	$.getJSON(
			jsonSource + '?mode=start',
		function (data) {handlePlayerStateRequest(data);}
	);
}

function controlStop() {
	$.getJSON(
		jsonSource + '?mode=stop',
		function (data) {handlePlayerStateRequest(data);}
	);
}

function controlNext() {
	$.getJSON(
		jsonSource + '?mode=skip',
		function (data) {handlePlayerStateRequest(data);}
	);
}

function controlVolumeDown() {
	if (volume != undefined) {
		volume -= 10;
		$.getJSON(
			jsonSource + '?mode=volume;value=' + volume,
			function (data) {handlePlayerStateRequest(data);}
		);
	}
}

function controlVolumeUp() {
	if (volume != undefined) {
		volume += 10;
		$.getJSON(
			jsonSource + '?mode=volume;value=' + volume,
			function (data) {handlePlayerStateRequest(data);}
		);
	}
}

$("#messageBox").ready(function() {
	$("#messageBox").dialog({
		autoOpen: false,
		modal: true,
		buttons: {"ok": function() {
			$(this).dialog("close");
			// set the text back to default
			// (so we know if someone forgot to set it in another call)
			$(this).html("no text... why?");
		}}
	});

	$("#messageBox").ajaxError(function (e, xhr, opts, err) {
		$(this).dialog('option', 'title', 'Communication Error');
		$(this).html(xhr.responseText);
		$(this).dialog('open');
	});
});

function formSearch() {
	$.address.value("SearchRequest/any/" + $("#search-box").val());
	return false;
}

function uriencode(str) {
	str = str.replace(/\&/g, '%26');
	str = str.replace(/\+/g, '%2b');
	str = str.replace(/\#/g, '%23');
	str = str.replace(/\//g, '%2f');

	return encodeURIComponent(str);
}

function pageLoadChange(hash) {
	hash = hash.replace(/^\//, '');
	var args = hash.split('/');
	var action = args.shift();
	if (!args[0]) args[0] = '';
	if (!args[1]) args[1] = '';
	if (action == '') {
		loadRandomSongs(20, (new Date()).getTime());
	} else if (action == 'RandomSongs') {
		loadRandomSongs(args[0], args[1]);
	} else if (action == 'RecentSongs') {
		loadRecentSongs(args[0]);
	} else if (action == 'PlayHistory') {
		loadPlayHistory(args[0], args[1]);
	} else if (action == 'SelectRequest') {
		selectRequest(args[0], args[1]);
	} else if (action == 'SearchRequest') {
		doSearch(args[0], args[1]);
	}
}

$.address.change(function(e) {pageLoadChange(e.value);});
