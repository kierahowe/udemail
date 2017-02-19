/*
GMAIL Supports...  

'IMAP4REV1',
  'UNSELECT',
  'IDLE',
  'NAMESPACE',
  'QUOTA',
  'ID',
  'XLIST',
  'CHILDREN',
  'X-GM-EXT-1',
  'UIDPLUS',
  'COMPRESS=DEFLATE',
  'ENABLE',
  'MOVE',
  'CONDSTORE',
  'ESEARCH',
  'UTF8=ACCEPT',
  'LIST-EXTENDED',
  'LIST-STATUS',
  'APPENDLIMIT=35882577' ]

 */


var inspect = require('util').inspect;
var Imap = require('imap');

function emailInput (id, details) { 
	this.anumber = 1;
	this.inboxImap = null;
	this.workerImap = [];
	this.boxes = [];
	this.id = id;

	this.settings = details;

	console.log ("loading email input");

	if (typeof details.workers == 'undefined' || details.workers < 1) { 
		this.settings.workers = 3;
	} else { 
		this.settings.workers = details.workers;
	}

	if (typeof details.checkInterval == 'undefined' || details.checkInterval < 60000) { 
		this.settings.checkInterval = 10000;
	} else { 
		this.settings.checkInterval *= 1000;
	}

	var detail;

	detail = { 
		'type': 'email_folder', 
		'name': "Email Folder",
		'uniqueToPlugin': true,
	};
	global.messages.registerMessageType (detail);
	detail = { 
		'type': 'email', 
		'name': "Email",
		'uniqueToPlugin': true,
	};
	global.messages.registerMessageType (detail);

}

emailInput.prototype.getInfo = function (callback) {
	console.log ("----- Infor request:"); 
	return { 
		'slug':  'udemail_emailin',
		'name':  'Email (IMAP)',
		'description': 'Email message input for POP or IMAP',
		'settingFields': [
			{name: 'username', outname: 'User Name', type: 'text', size: 20, required: true },
			{name: 'password', outname: 'Password', type: 'password', size: 20, required: true },
			{name: 'server', outname: 'Server Address', type: 'text', size: 20, required: true },
			{name: 'port', outname: 'Server Port', type: 'numeric', size: 20, required: true },
			{name: 'tls', outname: 'TLS security', type: 'checkbox' }
		]
	};
}

emailInput.prototype.mailboxCheck = function (a, b, c) { 
	console.log ("---- New mail", a, b, c);
}


emailInput.prototype.checkMailbox = function (connection) {
	var self = this; 

	console.log ("Checking mail");

	connection.openBox ('INBOX', false, function (err, box) {
		console.log ("Open Inbox - ", err, box);
	});
	connection.search([ 'NEW' ], function(err, results) {
    	if (err) throw err;
    	if (results.length == 0) { 
    		// no messages to fetch
    		return ;
    	}

		var f = connection.fetch(results, { bodies: '' });
	    f.on('message', function(msg, seqno) {
	      console.log('Message #%d', seqno);
	      console.log (msg);

	      var m = require ('../../message');
	      var mess = new m();
	      mess.setType ('email');
	      mess.setPluginId (self.id);

	      var prefix = '(#' + seqno + ') ';

	      msg.on('body', function(stream, info) {
	        console.log(prefix + 'Body');
	        console.log (stream);
	        mess.updateMessageMetaItem ('size', info.size);
			mess.updateMessageContent (stream, 'email_raw', function () { 
				mess.saveMessage ();
			});

	  //       var body = '';
	  //       stream.setEncoding('utf8');
			// stream.on('data', (chunk) => {
			// 	body += chunk;
			// });
			// stream.on('end', () => {
			// });
	        //stream.pipe(fs.createWriteStream('msg-' + seqno + '-body.txt'));
	      });
	      msg.once('attributes', function(attrs) {

	      	for (var i in attrs) { 
	      		if (i == 'date') { 
	      			mess.setTimein (attrs[i]);
	      		} else if (i == 'uid') { 
					mess.setUniqueId (attrs[i]);
	      		} else { 
		      		mess.updateMessageMetaItem (i, attrs[i]);
		      	}
	      	}
	        //console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
	      });
	      msg.once('end', function() {
		    
	        console.log(prefix + 'Finished');
	      });
	    });
	    f.once('error', function(err) {
	      console.log('Fetch error: ' + err);
	    });
	    f.once('end', function() {
	      console.log('Done fetching all messages!');
	      //connection.end();
	    });    	
    });

    return;

    var f = connection.seq.fetch('1:3', {
		bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
		struct: false
	});

    f.on('message', function(msg, seqno) {
		console.log('Message #%d', seqno);
		var prefix = '(#' + seqno + ') ';
		msg.on('body', function(stream, info) {
			var buffer = '';
			stream.on('data', function(chunk) {
				buffer += chunk.toString('utf8');
			});
			stream.once('end', function() {
				console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
			});
		});
		msg.once('attributes', function(attrs) {
			console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
		});
		msg.once('end', function() {
			console.log(prefix + 'Finished');
		});
    });

    f.once('error', function(err) {
		console.log('Fetch error: ' + err);
    });
    f.once('end', function() {
    	console.log('Done fetching all messages!');
    });
}

emailInput.prototype.recboxes = function (name, boxes, lev) { 
	var self = this;

	if (lev > 5) { return; }
	for (box in boxes) { 
		//console.log (box, boxes[box]['attribs']);
		var fullname = ((name != '')?name + boxes[box]['delimiter']:'') + box;

		//if (fullname != "INBOX") { continue; }
		flg = 0;
		for (bx in self.boxes) { 
			if (self.boxes[bx]['name'] == fullname) { flg = 1; break; }
		}

		if (flg == 0) { 
			var o = {'name': fullname }
			o['noselect'] = (boxes[box]['attribs'].indexOf ('\\Noselect') != -1)? true:false;
//			o['delimiter'] = boxes[box]['delimiter'];
			self.boxes.push (o);
		}

		if (boxes[box]['attribs'].indexOf ('\\HasChildren') != -1) { 
			self.recboxes(fullname, boxes[box]['children'], lev + 1);
		}
	}
}

emailInput.prototype.checkBoxChange = function () { 
	var self = this;

	self.imap.getBoxes (function (un, boxes) { 
		console.log ("b:", self.boxes);
		self.recboxes ("", boxes, 0);
		//self.inboxOpen ();
	});

	if (self.boxes.length == 0) { return; }

	for (box in self.boxes) {
		var doit = false;

		if (self.boxes[box]['name'] == "INBOX") { doit = true; }
		if (typeof self.boxes[box]['box'] == 'undefined') { doit = true; } 

		if (self.boxes[box]['name'] == "INBOX") { console.log(self.boxes[box]['box']); }

		if (doit) { 
			self.imap.openBox (self.boxes[box]['name'], true, function (err, b) {
				global.messages.updateMessage ({ 
						type: 'email_folder',
						pluginid: self.id, 
						uniqueid: b.name, 
						subject: b.name 

				});
				if (typeof err == "undefined") { 
					console.log ("Opened box " + b['name']);
					flg = 0;
					for (bx in self.boxes ) { 
						if (b['name'] == self.boxes[bx]['name']) { 
							console.log ("Found " + b['name'] + " -- " + self.boxes[bx]['name']);
							self.boxes[bx]['box'] = b;
							break;
						}
					}
				}
							
			// 	if (typeof err == 'undefined') { 
			//  		console.log ("Check box ", b);
			// //		self.checkMailbox(self.boxes[box], b);
				//}
			});
		}

		// if (typeof self.boxes[box]['box'] == 'undefined') { 
		// 	if (typeof self.boxes[box]['name'] != "undefined") { 
		// 		console.log ("Open box " + self.boxes[box]['name']);
		// 		self.imap.openBox (self.boxes[box]['name'], true, function (err, b) {
		// 			if (typeof err == "undefined") { 
		// 				console.log ("Opened box " + b['name']);
		// 				flg = 0;
		// 				for (bx in self.boxes ) { 
		// 					if (b['name'] == self.boxes[bx]['name']) { 
		// 						self.boxes[bx]['box'] = b;
		// 						self.boxes[bx]['uidvalidity'] = b['uidvalidity'];
		// 						console.log ("box setup " + self.boxes[bx]['name'], self.boxes[bx]['box']['uidvalidity'],self.boxes[bx]['uidvalidity']);
		// 						flg = 1;
		// 						break;
		// 					}
		// 				}
		// 				if (flg == 0) { 
		// 					console.log ("box not found " + b['name']);
		// 				}
		// 			} else { 
		// 				console.log ("Error opening mailbox: ", err);
		// 			}
		// 		});	
		// 	}
		// } else { 
		// 	if (self.boxes[box]['box']['uidvalidity'] != self.boxes[box]['uidvalidity']) { 
		// 		console.log ("Change found for box " + self.boxes[box]['name'], self.boxes[box]);
		// 	}

		// 	//console.log (self.boxes[box]);
		// }

	}
}

emailInput.prototype.checkNotify = function () { 
	// Called periodically to check stuff
	// 1. Get all the mailboxes, and then make sure none of the UIDs show change
	// 2. Make sure the inbox is still open
	// 3. Check the inbox for new messages

	console.log ("Checking for changes in email");

	self.imap.openBox (self.boxes[box]['name'], true, function (err, b) {

	});
	//this.checkBoxChange ();
}

emailInput.prototype.checkInboxNotify = function () { 
	// Called periodically to check the inbox
	// 1. Check the inbox for new messages

	console.log ("Checking for changes in email");
	this.checkMailbox (this.inboxImap);
};

emailInput.prototype.openImap = function (notifyfunction, openbox) { 
	var tmpimap;
    var self = this;

    // Open a new IMap instance
	tmpimap = new Imap({
		user: this.settings.username,
		password: this.settings.password,
		host: this.settings.server,
		port: this.settings.port,
		tls: this.settings.tls,
		// debug: function (out) { 
		// 	console.log (out);
		// }
	});

	// Whenever a uidvalidity changes... go check the mailbox for new messages
	tmpimap.once ('uidvalidity', function () { 
		console.log ("uidchange");
		//self.mailboxCheck ();
	});

	// When the connection becomes ready, open the inbox and any other things.
	tmpimap.once ('ready', function () { 
		self.connected = true;
		console.log ("Ready IMAP");

		var tmpfunc = function (err, b) {
			if (typeof err != "undefined") { 
				console.log ("Error opening INBOX:", err);
				return;
			}

			console.log ("Inbox Open!", b);

			if (tmpimap.serverSupports ('NOTIFY')) { 
				// TODO: support Notifications
				setInterval (function () { notifyfunction(); }, self.settings.checkInterval);
			} else { 
				setInterval (function () { notifyfunction(); }, self.settings.checkInterval);
			}
			notifyfunction();
		}

		if (typeof openbox != "undefined") { 
			tmpimap.openBox (openbox, true, tmpfunc);
		} else {
			tmpfunc;
		}
		//self.inboxOpen ();
	});

	tmpimap.once('update', function(x) {
		console.log ("update to a flag");
	});
	tmpimap.once('state', function(state) {
		console.log ("state change", state);
	});

	tmpimap.once('error', function(err) {
		if (!self.connected) { 
			console.log ("Failed to connect to server");
		}
		console.log("ERROR: ", err);
	});

	// if/when the connection ends, start it up again.
	tmpimap.once('end', function() {
		self.connected = false;
		self.imap.connect();
		console.log('Connection ended');
	});

	// make the connection
	tmpimap.connect();

	return tmpimap;
};

emailInput.prototype.startup = function() { 
	// Called from Main.  This is the input's startup routine.
	// All functions to start fetching messages will begin here
	// 

	console.log ("started email input");

    var self = this;
    var tmpimap;

    this.inboxImap = this.openImap (function () { self.checkInboxNotify (); }, 'INBOX');
}

module.exports = emailInput;	