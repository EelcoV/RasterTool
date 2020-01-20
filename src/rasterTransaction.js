/* Copyright (C) Eelco Vriezekolk, Agentschap Telecom.
 * See LICENSE.md
 */

/* globals Component, DEBUG, Project, RefreshNodeReportDialog, ThreatAssessment, autoSaveFunction, bugreport, checkForErrors, isSameString, exportProject, setModified
*/

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Transaction: object representing an undoable, shareable action.
 *
 * Transaction form a doubly linked list with three pointers (class properties:
 *  base: the start of the list, a special transaction with id==null
 *  current: the most recently performed transaction
 *  head: the most recently posted transaction
 * When undoing/redoing, current steps through the list while base and head remain unchanged.
 *
 * Class properties
 *  base: the start of the list, a special transaction with id==null
 *  current: the most recently performed transaction
 *  head: the most recently posted transaction
 * Class methods
 *  undo: undo the latest transaction (move Transaction.current backwards)
 *  redo: redo the most recently undone transaction (move Transaction.current forwards)
 *  updateUI: update the status of the Undo and Redo buttons
 * Instance properties:
 *  kind: (String) the type of transaction
 *  timestamp: (integer) time of this transaction's creation
 *  prev: previous
 *  undo_data: (any) an object or literal containing all information to undo the transaction
 *  do_data: (any) an object or literal containing all information to perform the transaction
 * Instance methods:
 *  perform(data): perform the action using data; data defaults to this.do
 *  undo: perform the action using this.undo.
 */
var Transaction = function(knd,undo_data,do_data) {
	this.kind = knd;
	this.timestamp = Date.now();
	this.undo_data = undo_data;
	this.do_data = do_data;
	if (this.kind==null) {
		this.prev = null;
		this.next = null;
		return;
	}
	// Perform this action, and make it the head of the transaction list.
	// If there are any actions between current and head, then these are discarded
	Transaction.current.next = this;
	this.prev = Transaction.current;
	this.perform();
	transactionCompleted("+ "+this.kind);

// Test!
checkForErrors();
let S1 = exportProject(Project.cid);
this.undo();
checkForErrors();
let S2 = exportProject(Project.cid);
this.perform();
checkForErrors();
let S3 = exportProject(Project.cid);
this.undo();
checkForErrors();
let S4 = exportProject(Project.cid);
this.perform();
if (S1!=S3) {
	logdiff(S1,S3,"in new: perform != perform");
} else if (S2!=S4) {
	logdiff(S2,S4,"in new: undo != undo");
}

	Transaction.current = this;
	Transaction.head = this;
	Transaction.updateUI();
};

Transaction.base = new Transaction(null,null,null);
Transaction.current = Transaction.base;
Transaction.head = Transaction.base;

Transaction.updateUI = function() {
	if (Transaction.current==Transaction.base) {
		$('#undobutton').removeClass('possible');
	} else {
		$('#undobutton').addClass('possible');
	}
	if (Transaction.current==Transaction.head) {
		$('#redobutton').removeClass('possible');
	} else {
		$('#redobutton').addClass('possible');
	}
};

Transaction.undo = function() {
	if (Transaction.current==Transaction.base)  return;
	try {

// Test!
checkForErrors();
let S1 = exportProject(Project.cid);
		Transaction.current.undo();
		transactionCompleted("< "+Transaction.current.kind);
checkForErrors();
let S2 = exportProject(Project.cid);
Transaction.current.perform();
checkForErrors();
let S3 = exportProject(Project.cid);
Transaction.current.undo();
checkForErrors();
let S4 = exportProject(Project.cid);

if (S1!=S3) {
	logdiff(S1,S3,"in undo: undo,redo != nil");
} else if (S2!=S4) {
	logdiff(S2,S4,"in undo: redo,undo != nil");
}

	} catch (e) {
		if (e!='TransactionCancel')  bugreport(e,"Transaction.undo");
	}
	Transaction.current = Transaction.current.prev;
	Transaction.updateUI();
};

Transaction.redo = function() {
	if (Transaction.current==Transaction.head)  return;
	try {

// Test!
checkForErrors();
let S1 = exportProject(Project.cid);
		Transaction.current.next.perform();
		transactionCompleted("> "+Transaction.current.next.kind);
checkForErrors();
let S2 = exportProject(Project.cid);
Transaction.current.next.undo();
checkForErrors();
let S3 = exportProject(Project.cid);
Transaction.current.next.perform();
checkForErrors();
let S4 = exportProject(Project.cid);

if (S1!=S3) {
	logdiff(S1,S3,"in redo: redo,undo != nil");
} else if (S2!=S4) {
	logdiff(S2,S4,"in redo: undo,redo != nil");
}

	} catch (e) {
		if (e!='TransactionCancel')  bugreport(e,"Transaction.redo");
	}
	Transaction.current = Transaction.current.next;
	Transaction.updateUI();
};


Transaction.prototype = {
	undo: function() {
		this.perform(this.undo_data);
	},

	perform: function(data) {
		if (!data)  data = this.do_data;
		switch (this.kind) {

		case 'classTitle':
			// Edit the title of a node class
			// data: array of objects; each object has these properties
			//  id: id of the component of the class
			//  title: title of the node class
			for (const d of data) {
				let cm = Component.get(d.id);
				let typ = Node.get(cm.nodes[0]).type;
				// Check that this title is not in use for this type in the project
				var it = new NodeIterator({project: cm.project, type: typ});
				for (it.first(); it.notlast(); it.next()) {
					let rn = it.getnode();
					if (isSameString(rn.title,d.title)) {
						throw('TransactionCancel');
					}
				}
				cm.settitle(d.title);
			}
			break;

		case 'nodeCreate':
			// Create a new node
			// data: array of objects; each object has these properties
			//  id: id of the node; this is the *only* property in the undo data
			//  type: type of the node
			//  title: title of the node class
			//  component: id of the component object
			//  thrass: info on the blank vulnerabilities
			for (const d of data) {
				if (d.type==null) {
					// This is undo_data: delete the node
// Change to true when not debugging
					Node.get(d.id).destroy(false);
					continue;
				}

				let rn = new Node(d.type, d.id);
				rn.settitle(d.title);
				rn.setposition(d.x,d.y);
// Change to true when not debugging
				rn.paint(false);
				if (d.type=='tNOT' || d.type=='tACT')  continue;

				let cm = new Component(d.type, d.componentid);
				for (const t of d.thrass) {
					let ta = new ThreatAssessment(t.type, t.id);
					ta.settitle(t.title);
					ta.setdescription(t.description);
					ta.setremark(t.remark);
					ta.setfreq(t.freq);
					ta.setimpact(t.impact);
					ta.computetotal();
					cm.addthrass(ta);
				}
				cm.settitle(d.title);
				cm.addnode(d.id);
			}
			break;

		case 'nodePosition':
			// Change the size and/or position of nodes
			// data: array of objects; each object has these properties
			//  id: id of the node
			//  x, y: position of the node
			for (const d of data) {
				let rn = Node.get(d.id);
				rn.setposition(d.x,d.y);
			}
			break;

		case 'nodeSuffix':
			// Edit the suffix of a node in a class
			// data: array of objects; each object has these properties
			//  id: id of the node
			//  suffix: suffix of the node
			for (const d of data) {
				let rn = Node.get(d.id);
				let cm = Component.get(rn.component);
				for (const i of cm.nodes) {
					if (i==rn.id) continue;
					let nn = Node.get(i);
					if (nn.suffix==d.suffix) {
						nn.settitle(nn.title,rn.suffix);
					}
				}
				rn.settitle(rn.title,d.suffix);
			}
			break;

		case 'nodeTitle':
			// Change the name of a node
			// data: array of objects; each object has these properties (some properties are optional)
			//  id: id of the node
			//  title: title of the node
			//  suffix: suffix of the node
			//  suffix2: suffix of the other node in the class
			//  thrass: array of threat assessments when the component needs to be created
			//		id, title, description, frequecy, impact, total, remark: as of the threat assessment
			//  component: id of the component
			for (const d of data) {
				let rn = Node.get(d.id);
				if (rn.type=='tNOT' || rn.type=='tACT') {
					if (rn.type=='tACT' && Node.projecthastitle(Project.cid,d.title)!=-1) {
						throw('TransactionCancel');
					}
					rn.settitle(d.title);
					continue;
				}
				if (!d.component) {
					// Simple case, no classes involved
					if (Node.projecthastitle(Project.cid,d.title)!=-1) {
						throw('TransactionCancel');
					}
					let cm = Component.get(rn.component);
					cm._settitle(d.title);
					rn.settitle(d.title,'');
					continue;
				}
				// More complex cases
				let cm = Component.get(d.component);
				if (!cm) {
					if (Component.hasTitleTypeProject(d.title,rn.type,Project.cid)!=-1) {
						throw('TransactionCancel');
					}
					// create a new component
					cm = new Component(rn.type,d.component);
					for (const t of d.thrass) {
						let ta = new ThreatAssessment(t.type, t.id);
						ta.settitle(t.title);
						ta.setdescription(t.description);
						ta.setremark(t.remark);
						ta.setfreq(t.freq);
						ta.setimpact(t.impact);
						ta.computetotal();
						cm.addthrass(ta);
					}
				}
				if (d.component!=rn.component) {
					let oldcm = Component.get(rn.component);
					oldcm.removenode(rn.id);
				}
				cm._settitle(d.title);
				if (d.suffix2) {
					let othernode = Node.get(cm.nodes[0]);
					othernode.settitle(othernode.title,d.suffix2);
				}
				if (cm.nodes.indexOf(rn.id)==-1) {
					cm.addnode(rn.id);
				}
				if (!d.suffix)  d.suffix=null;
				rn.settitle(d.title,d.suffix);
				rn.setmarker();
				RefreshNodeReportDialog();
			}
			break;

		default:
			bugreport('Unknown transaction id','Transaction.perform');
		}
	}
};

function transactionCompleted(str) {
	if (DEBUG)  console.log(str);
#ifdef SERVER
	autoSaveFunction();
#else
	setModified();
#endif
}


function logdiff(s1, s2, header) {
	let patt = new RegExp(/^(.+)\n/);
	let print = false;

	let r1=patt.exec(s1);
	let r2=patt.exec(s2);
	while (r1!=null && r2!=null) {
		if (r1[1]!=r2[1]) {
			if (!print)  console.log("===== "+header+" =======================");
			console.log(">> " + r1[1]);
			console.log("<< " + r2[1]);
			console.log("--");
			print=true;
		}
		s1 = s1.substr(r1[0].length);
		s2 = s2.substr(r2[0].length);
		r1=patt.exec(s1);
		r2=patt.exec(s2);
	}
}

