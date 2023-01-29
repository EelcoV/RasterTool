/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* global
#ifdef SERVER
_H, H, newRasterConfirm, prettyDate, ProjectIterator, rasterAlert, refreshStubList, startWatchingCurrentProject, switchToProject, urlEncode,
#else
prefsDir,
#endif
_, Assessment, AssessmentIterator, bugreport, Component, ComponentIterator, createUUID, exportProject, GroupSettings, isSameString, loadFromString, LS, nid2id, NodeCluster, NodeCluster, NodeClusterIterator, paintSingleFailures, Preferences, Rules, Service, ServiceIterator, SizeDOMElements, ToolGroup, Transaction, Vulnerability, VulnerabilityIterator, TabAnaVulnOverview, TabAnaAssOverview, TabAnaLonglist, repaintAnalysisIfVisible, reasonableString
*/

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Project: object representing a project
 *
 * Class variables (those prefixed with underscore should not be accessed from outside)
 *	cid: integer ID of the currently active project
 *	_all: Map of all projects, indexed on project ID
 *	get(i): returns the object with id 'i'.
 *	withTitle(str): returns the id of the local project with title 'str', or 'null' otherwise.
 *	firstProject(): returns the an existing local Project object, or null otherwise.
 *	UpdateStubs(): retrieve list of projects from server and update the UI.
 *	asyncRetrieveStub(i): download the stub project with id 'i' from the server.
 *	getProps(s): retrieve properties of remote project with name 's'.
 * Instance properties:
 *	id: UUID
 *	title: (string) short name of the project
 *  group: (string) group to which the project belongs (default group is ToolGroup)
 *		group is only meaningful when the project is shared or a stub.
 *		Webserver-based access controls may apply per group.
 *  shared: (boolean) true iff the project is shared, and stored on the server.
 *	description: free-form description (max 100 chars).
 *	services[]: list of service IDs of all services belonging to this project. Empty for stubs.
 *	vulns[]: list of all common Vulnerabilities belonging to this project, in UI order. Empty for stubs.
 *	labels[]: list of all label strings.
 *	creator: (string) creator, as returned by the server. Only used for stubs.
 *	date: (string) date, as returned by the server. Only used for stubs.
 *	stub: (boolean) true iff this is a stub.
 *  iconset: (string) name of the preferred iconset for this project.
 *	wpa: (string) worst plausible attacker for malicious actions/vulnerabilities. Sophistication level 'A' (lowest) to 'E' (highest)
 *  icondata: an object containing information on this iconset. See retrieicondata() for details.
 *  TransactionBase: the start of the transaction list, a special transaction with kind==null
 *  TransactionCurrent: the most recently performed transaction
 *  TransactionHead: the most recently posted transaction
 *		See rasterTransaction.js for description of these, and the transaction list.
 * Methods:
 *	destroy(): destructor for this object
 *  merge(pid): insert a duplicate of Project with pid into this project.
 *	duplicate(): creates an exact copy of this project, and returns that duplicate. NOTE: this will create two projects with the samen name.
 *  updateUndoRedoUI: highlight/lowlight the undo/redo buttons as necessary
 *  clearUndo: reset the undo-stack, after an action that causes irreversible changes.
 *	totalnodes(): returns the count of all nodes within all services of this project.
 *	settitle(t): change the title to 't' (50 chars max). The actual title may receive
 *		a numerical suffix to make it unique.
 *  autosettitle(): set the title using a default name.
 *	setshared(b): set sharing status to 'b' (boolean).
 *	setdescription(s): change description to 's'.
 *	setdate(d): change date to 'd'.
 *	setwpa(level): changa wpa to 'level' and recalculate Assessments, repaint Single Failures
 *	autosettitle: choose a unique standard name.
 *		Either settitle() or autosettitle() must be called.
 *	addservice(id,idx): add an existing Service object to this project, at position idx.
 *	removeservice(id): remove and destroy a Service object from this project.
 *  addvulnerability(id,clid,clthrid,idx): add a common vulnerability to the project, including id of new root cluster,
 *		id of the assessment of that cluster, and the index of the vulnerability within vulns[].
 *	removevulnerability(id): remove acommon vulnerability from the project.
 *  adddefaultvulns: add all Project default vulnerabilities.
 *  defaultassessmentdata(t): returns do/undo data for common vulnerabilities of type t.
 *	retrieveicondata(s): try to assign .icondata based on the ${s}/icondata.json on the server. Return true iff succesful.
 *	seticonset(s): change the iconset, and repaint all services
 *	paintTemplates: set DOM (templates and masks for the current icons)
 *	unload(): remove all DOM elements for this project.
 *	load(): create and set all DOM elements for this project.
 *  paintTemplates: paint the templates in the Home toolbar.
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
 *	storeOnServer(): save this project onto the server.
 *  storeIfNotPresent(): save this project onto the server, but do not overwrite existing files. (UNUSED)
 *	deleteFromServer(): remove this project from the server.
 *	getDate(): retrieve last saved date of this project. (UNUSED)
 *  refreshIfNecessary(): retrieve & replace this project from the server, if that version is newer.
 *  dorefresh(): wrapper around refreshIfNecessary.
 *  appendCurrentTransaction(): append this.TransactionCurrent to the transaction-list on the server.
 *  storeBaseTransaction(): save the base transaction ont the server (useful with an empy undo-list)
 *  getNewTransactionsFromServer: retrieve all transactions more recent than this.TransactionHead from the server, and apply.
 *  askForConflictResolution: make private, overrule (everyone uses our version), or adopt (we use the server version)
 */
var Project = function(id=createUUID(),asstub=false) {		// eslint-disable-line no-unused-vars
	if (Project._all.has(id)) {
		bugreport("Project with id "+id+" already exists","Project.constructor");
	}
	this.id = id;
	this.title = "?";
	this.group = ToolGroup;
	this.description = "";
	this.services = [];
	this.vulns = [];
	this.labels = Project.defaultlabels;
	this.creator = "";
	this.date = "";
#ifdef SERVER
	this.stub = (asstub===true);
#else
	this.stub = false;
#endif
	this.shared = this.stub;	// default to private, but stubs are always shared

	this.iconset = GroupSettings.iconsets[0];
	this.wpa = 'A';
	this.icondata = {};
	// Do not fetch the iconset yet, delay this until Project.load()

	this.TransactionBase = new Transaction(null,null,null,null,false,false,createUUID(),this.id);
	this.TransactionCurrent = this.TransactionBase;
	this.TransactionHead = this.TransactionBase;

	this.store();
	Project._all.set(this.id,this);
};
Project.get = function(id) { return Project._all.get(id); };
Project.cid = 0;
Project._all = new Map();
Project.defaultlabels = [_("Red"), _("Orange"), _("Yellow"), _("Green"), _("Blue"), _("Pink"), _("Purple"), _("Grey")];
Project.colors = ["none","red","orange","yellow","green","blue","pink","purple","grey"];
Project.defaultVulnerabilities = [		// eslint-disable-line no-unused-vars
	/* [ type , title , malicious, description ] */
	["tWLS",_("Interference"),		false, _("Unintentional interference by a radio source using the same frequency band.")],
	["tWLS",_("Congestion"),		false, _("The amount of traffic offered exceeds the capacity of the link.")],
	["tWLS",_("Signal weakening"),	false, _("Loss of signal strength through distance or blocking by buildings, trees, etc.")],
	["tWLS",_("Jamming"),			true,  _("Intentional interference or denial of service (DDOS) by some third party.")],
	["tWRD",_("Break"),				false, _("Cable damaged by natural events, aging, trenching, anchors, or other external influence.")],
	["tWRD",_("Congestion"),		false, _("The amount of traffic offered exceeds the capacity of the link.")],
	["tWRD",_("Denial of service"),	true,  _("Intentional congestion (DDOS).")],
	["tEQT",_("Physical damage"),	false, _("Fire, flood, knocks and other physical damage inflicted.")],
	["tEQT",_("Power"),				false, _("Failure of electrical power supply.")],
	["tEQT",_("Configuration"),		false, _("Incorrect configuration or mistakes by operators or users.")],
	["tEQT",_("Malfunction"),		false, _("Failure of an internal module without a clear external cause, possibly by aging.")],
	["tEQT",_("Theft"),				true,  _("Insider our outsider steals the item through embezzlement or burglary.")],
	["tEQT",_("Software"),			true,  _("Exploits due to lack of updates, zero days, or insecure settings/configuration.")],
	["tEQT",_("Unsafe use"),		true,  _("Social engineering, phishing, weak or shared passwords.")]
];


// Check wether there is a project with name 'str' and group ToolGroup
Project.withTitle = function(str) {
	for (var idobj of Project._all) {
		let p = idobj[1];
		if (p.stub) continue;
		if (isSameString(p.title,str)  && (!p.shared || p.group==ToolGroup)) {
			return p.id;
		}
	}
	return null;
};

// Retrieve first project in ToolGroup
Project.firstProject = function() {
	for (var idobj of Project._all) {
		var p = idobj[1];
		if (p.stub) continue;
		if (!p.shared || p.group==ToolGroup)  return p;
	}
	return null;
};

#ifdef SERVER
// Make sure that at most one request runs at any time
// This should not be necessary, but may be useful during debugging.
Project.updateStubsInProgress=false;

/* UpdateStubs(load_async,dorepaint): replace all stubs with the project list currently on the server.
 *  load_async: (Boolean, default=true) if true then wait for results before returning
 *  dorepaint: (Boolean, default=true) if true then update the visible UI
 * Add all projects that can be found on the server, except those that share their name with a
 * project that is shared, as stub projects. All current stubs are removed or replaced.
 */
Project.UpdateStubs = function(load_async=true,dorepaint=true) {
	if (!Preferences.online)  return; // No actions when offline
	// Ignore if we already have a request running.
	if (Project.updateStubsInProgress) {
		console.log('Project.updateStubs aborted; already in progress');
		return;
	}
	Project.updateStubsInProgress=true;
	// Fire off request to server
	$.ajax({
		url: 'share.php?op=list',
		async: load_async,
		dataType: 'json',
		success: function(data) {
			// Remove all current stub projects
			var it = new ProjectIterator({group: ToolGroup, stub: true});
			it.forEach(p => p.destroy());
			for (const rp of data) {
				// Skip the server version if we are already sharing this project (avoid duplicate)
				var p = Project.withTitle(rp.name);
				if (p!=null && Project.get(p).shared==true) continue;

				p = new Project(createUUID(),true);
				p.title = rp.name;
				p.creator = rp.creator;
				p.date = rp.date;
				p.description = unescapeNewlines(rp.description);
			}
			refreshStubList(dorepaint);
			Project.updateStubsInProgress=false;
		},
		error: function(jqXHR, textStatus) {
			if (textStatus=="timeout") {
				Preferences.setonline(false);
				rasterAlert(_("Server is offline"),
					_H("The server appears to be unreachable. The tool is switching to working offline.")
				); 
			} else {
				rasterAlert(_("A request to the server failed"),
					_("Could not retrieve the list of remote projects.\nThe server reported:<pre>%%</pre>", H(jqXHR.responseText))
				);
			}
			Project.updateStubsInProgress=false;
		},
		complete: function() {
			Project.updateStubsInProgress=false;
		}
	});
};

Project.retrieveInProgress=false;

/* asyncRetrieveStub(pid,doWhenReady,doOnError,removepid): create a project from a stub.
 *  pid: id of the stub project
 *  doWhenReady (optional): function(newpid) to call after the project is loaded. Parameter newpid is the id of the loaded project.
 *  doOnError (optional): function(jqXHR, textStatus, errorThrown) to call on errors
 *  removepid (optional): id of project to remove before loading the stub.
 */
Project.asyncRetrieveStub = function(pid,doWhenReady,doOnError,removepid) {
	if (!Preferences.online)  return; // No actions when offline
	if (Project.retrieveInProgress)  return;

	var p = Project.get(pid);
	if (!p.stub) {
		bugreport("Retrieving a project that is not a stub","Project.retrieve");
		return;
	}
	Project.retrieveInProgress = true;
	$.ajax({
		url: 'share.php?op=getproject'+
			'&name=' + urlEncode(p.title) +
			'&creator=' + urlEncode(p.creator) +
			'&date=' + urlEncode(p.date),
		dataType: 'json',
		success: function (data) {
			/* data.project: (String) the project as text (one key:value pair per line)
			 * data.transactions: Array of objects containing stored transactions
			 */
			if (removepid!=null) Project.get(removepid).destroy();
			var newp = loadFromString(data.project,{
				strsource:'Remote project',
				duplicate: GroupSettings.classroom || isSameString(p.title,GroupSettings.template)
			});
			if (newp!=null) {
				var np = Project.get(newp);
				np.date = p.date;
				if (GroupSettings.classroom) {
					np.shared = false;
					np.settitle(np.title + _(" - personal copy"));
				} else {
					np.shared = true;
				}
				np.store();
				data.transactions.forEach(tr => {
					let nt = new Transaction(
						tr.kind,
						tr.undo_data,
						tr.do_data,
						tr.descr,
						tr.chain,
						false,
						tr.id,
						np.id,
						true // create only
					);
					if (tr.kind==null) {
						np.TransactionBase = nt;
						np.TransactionHead = nt;
						np.TransactionCurrent = nt;
					}
				});
				if (doWhenReady) {
					doWhenReady(newp);
				}
			} else {
				// Retrieve succeeded, but it still counts as an error because no valid project was found.
				// Duplicate the code for 'error:' below
				if (doOnError) {
					var jqXHR = {responseText: "Invalid project received from server."};
					doOnError(jqXHR, jqXHR.responseText, jqXHR.responseText);
				} else {
					rasterAlert(_("Invalid project received from server"),
						_H("An invalid project was received from the server.")
					);
				}
			}
			Project.retrieveInProgress = false;
		},
		error: function(jqXHR, textStatus, errorThrown) {
			if (textStatus=="timeout") {
				Preferences.setonline(false);
				rasterAlert(_("Server is offline"),
					_H("The server appears to be unreachable. The tool is switching to working offline.")
				);
				if (doOnError) {
					doOnError(jqXHR, textStatus, errorThrown);
				}
			} else {
				if (doOnError) {
					doOnError(jqXHR, textStatus, errorThrown);
				} else {
					rasterAlert(_("A request to the server failed"),
						_("Could not retrieve the remote project.\nThe server reported:<pre>%%</pre>", H(jqXHR.responseText))
					);
				}
			}
			Project.retrieveInProgress = false;
		},
		complete: function() {
			Project.retrieveInProgress = false;
		}
	});
};

Project.getProps = function(pname,doWhenReady) {
	if (!Preferences.online)  return; // No actions when offline
	$.ajax({
		url: 'share.php?op=getprops'+'&name=' + urlEncode(pname),
		dataType: 'json',
		success: function (data) {
			if (doWhenReady) {
				if (data && data.description) {
					data.description = unescapeNewlines(data.description);
				}
				doWhenReady(data);
			}
		},
		error: function(jqXHR, textStatus /*, errorThrown*/) {
			if (textStatus=="timeout") {
				Preferences.setonline(false);
				rasterAlert(_("Server is offline"),
					_H("The server appears to be unreachable. The tool is switching to working offline.")
				); 
			} else {
				rasterAlert(_("A request to the server failed"),
					_("Could not retrieve properties the remote project.\nThe server reported:<pre>%%</pre>", H(jqXHR.responseText))
				);
			}
		}
	});
};
#endif

Project.prototype = {
	destroy: function() {
		this.unload();
		for (const sid of this.services) Service.get(sid).destroy();
		let it = new NodeClusterIterator({project: this.id});
		it.forEach(nc => nc.destroy());
		it = new VulnerabilityIterator({project: this.id});
		it.forEach(v => v.destroy());
		localStorage.removeItem(LS+'P:'+this.id);
		Project._all.delete(this.id);
		if (Project.cid==this.id) Project.cid=null;
	},
	
	merge: function(pid) {
		let newpid = loadFromString(exportProject(pid),{strsource:'Merge', duplicate: true});
		if (newpid==null) {
			bugreport(`Failed to re-import project ${pid}`, "Project.merge");
			return;
		}
		let otherproject = Project.get(newpid);
		let ita = new AssessmentIterator({project: newpid});
		let it = new VulnerabilityIterator({project: newpid});
		let it2 = new VulnerabilityIterator({project: this.id});
		let vrenumber = [];

		for (const v of it) {
			// If this project already contains a vulnerability with the same name and type,
			// we can suffice by renumbering assessments from otherproject. Otherwise, we need
			// to move the vulnerability over to this project
			it2.forEach( (tv) => {
				if (tv.type==v.type && isSameString(tv.title,v.title)) {
					// renumbering required
					vrenumber[v.id] = tv.id;
				}
			});
			if (vrenumber[v.id]==undefined) {
				// move into this project
				v.project = this.id;
				v.setcommon(false);
				let loc = otherproject.vulns.indexOf(v.id);
				otherproject.vulns.splice(loc,1);
			}
		}
		
		// renumber vulnerabilities now
		ita.forEach( a => {
			let oldvid = a.vulnerability;
			if (vrenumber[a.vulnerability]!=undefined)  a.vulnerability = vrenumber[a.vulnerability];
			if (a.cluster==null) return;
			
			let cl = NodeCluster.get(a.cluster);
			// Cluster is root, for a vulnerability that is new to this project (vrenumber[oldvid]==undefined)
			//		-> move it over into this project (the vulnerability has already been moved)
			// Cluster is root, for a vulnerability already known to this project (vrenumber[oldvid]!=undefined)
			//		-> make the cluster a childcluster of the existing root in this project, then normalize
			// Cluster is not root
			//		-> move it over into this project
			//
			cl.setproject(this.id);
			if (cl.isroot() && vrenumber[oldvid]) {
				// cl becomes a child cluster. Child clusters have no vulnerability associated with them
				a._title = `${cl.title} from project "${otherproject.title}"`;
				cl.title = a._title;
				a.vulnerability = null;
				// Find the existing cluster for this vulnerability
				let it2 = new NodeClusterIterator({project: this.id, isroot: true});
				for (const thiscl of it2) {
					let thista = Assessment.get(thiscl.assmnt);
					if (thista.vulnerability==vrenumber[oldvid]) {
						thiscl.addchildcluster(cl.id);
						thiscl.normalize();
						break;
					}
				}
			}
		});
		
		// Move each of the services over, one by one
		for (const sid of otherproject.services) {
			var s = Service.get(sid);
			s.setproject(this.id);
			// add number to title, if this project already has a service with title s.title
			s.settitle(s.title);
			this.services.push(s.id);

			it = new ComponentIterator({service: s.id});
			for (const cm of it) {
				cm.setproject(this.id);
				it2 = new ComponentIterator({project: this.id, type: cm.type});
				for (const cm2 of it2) {
					if (cm2.id==cm.id) continue;
					if (!isSameString(cm2.title,cm.title)) continue;

					// There is already a component in this project with title cm.title
					// cm needs to be merged into cm2.
					cm2.absorbe(cm);
					break;	// Can occur only once, as cm2.title must be unique in otherproject
				}
			}
			
/*			// All nodes in this service need to be added to the proper NodeCluster in intoproject
			it = new NodeIterator({service: s.id});
			for (const rn of it) {
				if (rn.type=='tACT' || rn.type=='tNOT') continue;

				let cm = Component.get(rn.component);
				// If the node was added to a singular component, it doesn't need to added,
				// unless it is the first node in the singular class.
				if (cm.single && cm.nodes[0]!=rn.id) continue;

				for (var j=0; j<cm.assmnt.length; j++) {
					var ta = Assessment.get(cm.assmnt[j]);
					// During absorbe() in the loop above rn may already have been added to the
					// node clusters. Therefore, duplicateok==true in this call.
					NodeCluster.addnode_threat(this.id,rn.id,ta.title,ta.type,true);
				}
			}
*/

		}

		this.store();
		otherproject.services = [];
		otherproject.destroy();

		this.clearUndo();
		if (this.shared) {
			this.storeOnServer();
		}
	},

	duplicate: function() {
		let tr = new Map();	// translates UUIDs in this to new UUIDs
		tr.set(null,null);
		let it;
		// First collect all new UUIDs
		it = new VulnerabilityIterator({project: this.id});
		it.forEach(obj => tr.set(obj.id,createUUID()));
		it = new ServiceIterator({project: this.id});
		it.forEach(obj => tr.set(obj.id,createUUID()));
		it = new ComponentIterator({project: this.id});
		it.forEach(obj => tr.set(obj.id,createUUID()));
		it = new NodeIterator({project: this.id});
		it.forEach(obj => tr.set(obj.id,createUUID()));
		it = new AssessmentIterator({project: this.id});
		it.forEach(obj => tr.set(obj.id,createUUID()));
		it = new NodeClusterIterator({project: this.id});
		it.forEach(obj => tr.set(obj.id,createUUID()));
		let transaction = this.TransactionBase;
		do {
			tr.set(transaction.id,createUUID());
			transaction = transaction.next;
		} while (transaction!=null);
		tr.set(this.id,createUUID());
		// Now that we have all existing and new UUIDs, clone each of the objects
		let p = new Project(tr.get(this.id));
		p.title = this.title;
		p.group = this.group;
		p.description = this.description;
		this.services.forEach( (v,i) => p.services[i]=tr.get(v) );
		this.vulns.forEach( (v,i) => p.vulns[i]=tr.get(v) );
		p.labels = this.labels.slice();
		p.creator = this.creator;
		p.date = this.date;
		p.shared = this.shared;
		p.stub = this.stub;
		p.store();
		// Clone the list of transactions
		transaction = this.TransactionBase;
		p.TransactionBase = new Transaction(null,null,null,null,false,false,tr.get(transaction.id),p.id,true);
		p.TransactionCurrent = p.TransactionBase;
		p.TransactionHead = p.TransactionBase;
		while (transaction.next!=null) {
			transaction = transaction.next;
			new Transaction(
				transaction.kind,
				transaction.undo_data,
				transaction.do_data,
				transaction.descr,
				transaction.chain,
				false,
				tr.get(transaction.id),
				p.id,
				true // create only
			);
		}
		// Now duplicate all other referenced objects
		it = new VulnerabilityIterator({project: this.id});
		it.forEach(vln => {
			let vc = new Vulnerability(p.id,vln.type,tr.get(vln.id));
			vc.title = vln.title;
			vc.description = vln.description;
			vc.common = vln.common;
			vc.store();
		});
		it = new ServiceIterator({project: this.id});
		it.forEach(svc => {
			let sc = new Service(p.id,tr.get(svc.id));
			sc.title = svc.title;
			sc.store();
		});
		it = new ComponentIterator({project: this.id});
		it.forEach(cm => {
			let cc = new Component(cm.type, p.id, tr.get(cm.id));
			cm.nodes.forEach( (v,i) => cc.nodes[i] = tr.get(v) );
			cc.title = cm.title;
			cm.assmnt.forEach( (v,i) => cc.assmnt[i] = tr.get(v) );
			cc.magnitude = cm.magnitude;
			cc.single = cm.single;
			cc._markeriod = "#sfamark"+'_asdfasdf_'+'_'+tr.get(cm.id);
			cc.accordionopened = cm.accordionopened;
			cc.store();
		});
		it = new NodeIterator({project: this.id});
		it.forEach(nd => {
			let nc = new Node(nd.type,tr.get(nd.service),tr.get(nd.id));
			nc.index = nd.index;
			nc.position = Object.assign({},nd.position);	// clone position object
			nd.connect.forEach( (v,i) => nc.connect[i] = tr.get(v) );
			nc._normw = nd._normw;
			nc._normh = nd._normh;
			nc.component = tr.get(nd.component);
			nc.title = nd.title;
			nc.suffix = nd.suffix;
			nc.color = nd.color;
			nc.store();
		});
		it = new AssessmentIterator({project: this.id});
		it.forEach(assm => {
			let ac = new Assessment(assm.type,tr.get(assm.id));
			ac.vulnerability = tr.get(assm.vulnerability);
			ac.component = tr.get(assm.component);
			ac.cluster = tr.get(assm.cluster);
			ac._title = assm._title;
			ac.freq = assm.freq;
			ac.impact = assm.impact;
			ac.minimpact = assm.minimpact;
//			ac._impactoid = ... ;
			ac.total = assm.total;
			ac.remark = assm.remark;
			ac.store();
		});
		it = new NodeClusterIterator({project: this.id});
		it.forEach(nc => {
			let cc = new NodeCluster(nc.type,tr.get(nc.id));
			cc.title = nc.title;
			cc.project = p.id;
			cc.parentcluster = tr.get(nc.parentcluster);
			nc.childclusters.forEach( (v,i) => cc.childclusters[i]=tr.get(v) );
			nc.childnodes.forEach( (v,i) => cc.childnodes[i]=tr.get(v) );
			cc.assmnt = tr.get(nc.assmnt);
			cc.magnitude = nc.magnitude;
			cc.accordionopened = nc.accordionopened;
			cc.store();
		});
		return p;
	},
	
	updateUndoRedoUI: function() {
		if (this.TransactionCurrent==this.TransactionBase) {
			$('#undobutton').addClass('ui-state-disabled');
			$('#undobutton').attr('title', _("Undo"));
		} else {
			$('#undobutton').removeClass('ui-state-disabled');
			$('#undobutton').attr('title', _("Undo") + ' ' + this.TransactionCurrent.descr);
		}
		if (this.TransactionCurrent==this.TransactionHead) {
			$('#redobutton').addClass('ui-state-disabled');
			$('#redobutton').attr('title', _("Redo"));
		} else {
			$('#redobutton').removeClass('ui-state-disabled');
			$('#redobutton').attr('title', _("Redo") + ' ' + this.TransactionCurrent.next.descr);
		}
	},

	clearUndo: function() {
		this.TransactionBase = new Transaction(null,null,null,null,false,false,createUUID(),this.id);
		this.TransactionCurrent = this.TransactionBase;
		this.TransactionHead = this.TransactionBase;
#ifdef SERVER
		// Clear the transactions-list on the server, if any
		if (this.shared) this.storeBaseTransaction();
#endif
	},
	
	totalnodes: function() {
		let it = new NodeIterator({project: this.id});
		return it.count();
	},
	
	settitle: function(newtitle) {
		newtitle = String(newtitle).trim().substr(0,50);
		if (newtitle==this.title)  return;
		if (newtitle=='')  return;
		var targettitle = newtitle;
		if (Project.withTitle(targettitle)!=null) {
			var n=0;
			do {
				targettitle = newtitle + " (" + (++n) + ")";
			} while (Project.withTitle(targettitle)!=null);
		}
		this.title = targettitle;
		this.store();
	},

	autosettitle: function() {
		this.settitle(_("New project"));
	},

#ifdef SERVER
	setshared: function(b,updateServer) {
		if (GroupSettings.localonly) {
			this.shared = false;
			this.store;
			return;
		}
		var newstatus = (b===true);
		if (this.shared==newstatus)  return;

		this.group = ToolGroup;
		if (updateServer==undefined || updateServer==true) {
			if (newstatus==true) {
				// Project was private, now becomes shared.
				this.storeOnServer();
			} else {
				// Project was shared, now becomes private.
				this.deleteFromServer();
			}
		}
		this.shared = newstatus;
		this.store();
		startWatchingCurrentProject();
	},
#endif

	setdescription: function(s) {
		s = reasonableString(s);
		if (this.description==s) return;
		this.description = s;
		this.store();
	},
	
	setdate: function(d) {
		this.date = String(d).trim().substr(0,20);
		this.store();
	},

	setwpa: function(l) {
		if (this.wpa==l) return;
		if (['A','B','C','D','E'].indexOf(l)==-1) return;
		this.wpa = l;
		let it = new AssessmentIterator({project: this.id, malice: true});
		// Repaint all Difficulty levels
		it.forEach(asmnt => {
			// Re-compute the display values of all malicious assessments
			asmnt.computetotal();
			// Find all services for this assessment
			if (asmnt.component==null) return;
			let cm = Component.get(asmnt.component);
			let svcs = new Set();
			cm.nodes.forEach(nid => svcs.add(Node.get(nid).service));
			for (const sid of svcs) {
				let prefix = `sfa${sid}_${cm.id}`;
				$(`#dth_${prefix}freq${asmnt.id}`).text(asmnt.freqDisp);
			}
		});
		// Repaint all relevant Analysis tabs
		repaintAnalysisIfVisible(TabAnaVulnOverview);
		repaintAnalysisIfVisible(TabAnaAssOverview);
		repaintAnalysisIfVisible(TabAnaLonglist);
		this.store();
	},

	addservice: function(id,idx) {
		var s = Service.get(id);
		if (this.services.indexOf(s.id)!=-1) {
			bugreport("service already added","Project.addservice");
		}
		s.setproject(this.id);
		if (idx==null)  idx = this.services.length;
		this.services.splice(idx,0,s.id);
		this.store();
	},
	
	removeservice: function(id) {
		var s = Service.get(id);
		if (this.services.indexOf(s.id)==-1) {
			bugreport("no such service","Project.removeservice");
		}
		this.services.splice( this.services.indexOf(s.id),1 );
		s.destroy();
		this.store();
	},

	addvulnerability: function(vid,clid,thrid,idx) {
		if (!clid)  clid = createUUID();
		if (!thrid)  thrid = createUUID();
		if (idx==null)  idx = this.vulns.length;
		if (this.vulns.indexOf(vid)!=-1) {
			bugreport("vulnerability already added","Project.addvulnerability");
		}
		let vln = Vulnerability.get(vid);
		vln.project = this.id;
		vln.setcommon(true);
		this.vulns.splice(idx,0,vln.id);
		this.store();

		// Make sure that the project has a rootcluster for this vulnerability
		let it = new NodeClusterIterator({project: this.id, title: vln.title, type: vln.type, isroot: true});
		if (it.isEmpty()) {
			let nc = new NodeCluster(vln.type,clid);
			nc.setproject(this.id);
			nc.settitle(vln.title);
			nc.addassessment(thrid);
			Assessment.get(thrid).setvulnerability(vid);
		}
	},
	
	removevulnerability: function(id) {
		let loc = this.vulns.indexOf(id);
		if (loc==-1) {
			bugreport("no such vulnerability","Project.removevulnerability");
		}
		this.vulns.splice(loc,1);
		let vln = Vulnerability.get(id);
		vln.setcommon(false);
		this.store();
	},
	
	adddefaultvulns: function() {
		for (const dv of Project.defaultVulnerabilities) {
			let vln = new Vulnerability(this.id,dv[0],createUUID());
			vln.settitle(dv[1]);
			vln.setmalice(dv[2]);
			vln.setdescription(dv[3]);
			this.addvulnerability(vln.id,createUUID(),createUUID());
		}
	},

	defaultassessmentdata: function(typ) {
		let arr = [];
		let it = new VulnerabilityIterator({project: this.id, match: typ, common: true});
		for (const vln of it) {
			arr.push({
				id: createUUID(),
				type: vln.type,
				vulnerability: vln.id,
				malice: vln.malice,
				freq: '-',
				impact: '-',
				remark: ''
			});
		}
		return arr;
	},

	/* p.retrieveicondata(): fill the p.icondata object based on the name p.iconset.
	 * icondata is an object containing these fields:
	 *	setDescription: (String) a localised name for this iconset
	 *	dir: (String) path of the directory in which the iconset is stored
	 *	icons[]: array with specifications for each of the icons in the iconset.
	 * Each description is an object with these fields:
	 *	type: a Raster type (cannot be tNOT, as notes do not have icons)
	 *	image: (String) path to the icon file, relative to icondata.dir
	 *	mask: (String) path to the mask of the icon file, relative to icondata.dir
	 *	template: (String) path to the template file, relative to icondata.dir. Is used only on the first icon of each type.
	 *	width: (Number) width of the icon, in pixels
	 *	height: (Number) height of the icon, in pixels.
	 *	title: (String) placement of the icon title; one of 'inside', 'below', 'topleft'.
	 *	margin: (Number) width of the left and right margins, as a percentage of the width
	 *	offsetConnector: (Number, between 0 and 1) horizontal position of the top-connector
	 *	maintainAspect: (Boolean) iff false then width and height can be resized independently.
	 */
	retrieveicondata: function(setname) {
		function trydir(dir,p) {
			let iurl = `${dir}/iconset/${setname}/iconset.json`;
			let trydirres = true;
			$.ajax({
				url: iurl,
				async: false,
				dataType: 'json',
				error: function(jqXHR, textStatus) {
					if (textStatus=='parsererror') console.log(`Incorrect JSON syntax in ${iurl}`);
					trydirres = false;
				},
				success: function(data) {
					p.icondata.setDescription = mylang(data.setDescription);
					p.icondata.dir = `${dir}/iconset/${setname}`;
					p.icondata.icons = [];
					for (const r of data.icons) {
						var i;
						// set somewhat sane default values for each attribute
						i = {
							width: 100,
							height: 30,
							title: 'inside',
							margin: 0,
							offsetConnector: 0.5, // center
							maintainAspect: true
						};
						if (r.type==null) break; // mandatory
						if (r.image==null) break; // mandatory
						if (Rules.nodetypes[r.type]==null) break; // invalid type
						
						i.type = r.type;
						i.image = r.image;
						i.mask = (r.mask!=null ? r.mask : i.image.replace(/(.+)\.(\w+)$/, '$1-mask.$2'));
						i.template = (r.template!=null ? r.template : i.image.replace(/(.+)\.(\w+)$/, '$1-template.$2'));
						i.name = (r.name!=null ? mylang(r.name) : r.image);
						if (r.width!=null) i.width = r.width;
						if (r.height!=null) i.height = r.height;
						if (r.title!=null) i.title = r.title;
						if (r.margin!=null) i.margin = r.margin;
						if (r.offsetConnector!=null) i.offsetConnector = r.offsetConnector;
						if (r.maintainAspect!=null) i.maintainAspect = r.maintainAspect;
						if (i.offsetConnector<0.0 || i.offsetConnector>1.0) {
							console.log(`Correcting invalid offsetConnector value (${i.offsetConnector}) for icon ${i.image}`);
							i.offsetConnector = 0.5;
						}
						if (i.width<20 || i.width>200) {
							console.log(`Correcting invalid width value (${i.width}) for icon ${i.image}`);
							i.width = 100;
						}
						if (i.height<10 || i.height>100) {
							console.log(`Correcting invalid height value (${i.height}) for icon ${i.image}`);
							i.height = 30;
						}
						if (['inside','below','topleft'].indexOf(i.title)==-1) {
							console.log(`Correcting invalid title specification (${i.title}) for icon ${i.image}`);
							i.title = 'inside';
						}
						// Precompute maskid from the mask filename; replace periods by hyphens, and slashes by underscores
//						i.maskid = i.mask.replace(/\./g,'-').replace(/\//g,'_');
						p.icondata.icons.push(i);
					}
				}
			});
			return trydirres;
		}

		let res;
#ifdef SERVER
		res = trydir('../img',this) || trydir('.',this) ;
#else
		res = trydir('../img',this) || trydir(prefsDir,this);
#endif
		if (!res) {
			console.log(`Failed to load iconset ${setname}`);
		}
		return res;
	},
	
	seticonset: function(iconset) {
		if (this.iconset==iconset) return;
		if (GroupSettings.iconsets.indexOf(iconset)==-1) return;
		if (this.id==Project.cid) {
			let res = this.retrieveicondata(iconset);
			if (!res) return;
			this.iconset = iconset;
			this.store();
			this.paintTemplates();
			this.services.forEach(sid => {
				let svc = Service.get(sid);
				svc.unload();
				svc.load();
				paintSingleFailures(svc);
			});
			if (Preferences.tab==0) {
				$('#tab_diagramstabtitle'+Service.cid).trigger('click');
			} else if (Preferences.tab==1) {
				$('#tab_singlefstabtitle'+Service.cid).trigger('click');
			}
		} else {
			this.iconset = iconset;
			this.store();
		}
	},

	unload: function() {
		if (Project.cid!=this.id) return;
		for (const sid of this.services) Service.get(sid).unload();
		$('#tWLSthreats').empty();
		$('#tWRDthreats').empty();
		$('#tEQTthreats').empty();
		$('.projectname').empty();
	},

	load: function() {
		Project.cid = this.id;
		Service.cid = this.services[0];
		Preferences.setcurrentproject(this.title);

		this.updateUndoRedoUI();
		// Fetch and load the icons and templates. Fall back to 'default' if the iconset cannot be found
		if (!this.retrieveicondata(this.iconset)) {
			this.iconset = 'default';
			this.store();
			this.retrieveicondata(this.iconset);
		}
		this.paintTemplates();
		this.services.forEach(sid => Service.get(sid).load());
		for (const vid of this.vulns) {
			let vln = Vulnerability.get(vid);
			if (!vln)  bugreport('unknown vulnerability encountered','Project.load');
			switch (vln.type) {
			case 'tWLS':
				vln.addtablerow('#tWLSthreats');
				break;
			case 'tWRD':
				vln.addtablerow('#tWRDthreats');
				break;
			case 'tEQT':
				vln.addtablerow('#tEQTthreats');
				break;
			default:
				bugreport('unknown type encountered','Project.load'); 
			}
		}
		$('.malset label').removeClass('ui-corner-left ui-corner-right');

		var pid = this.id;
		var sortfunc = function(/*event,ui*/) {
			var p = Project.get(pid);
			var newlist = [];
			$('#tWLSthreats .threat').each( (index,elem) => newlist.push(nid2id(elem.id)) );
			$('#tWRDthreats .threat').each( (index,elem) => newlist.push(nid2id(elem.id)) );
			$('#tEQTthreats .threat').each( (index,elem) => newlist.push(nid2id(elem.id)) );
			if (newlist.length != p.vulns.length) {
				bugreport("internal error in sorting default vulnerabilities","Project.load");
			}
			new Transaction('vulnsReorder',
				{project: pid, list: p.vulns},
				{project: pid, list: newlist},
				_("Reorder vulnerabilities")
			);
		};
		$('#tWLSthreats').sortable({
			containment: 'parent',
			helper: 'clone',
			cursor: 'ns-resize',
			deactivate: sortfunc
		});
		$('#tWRDthreats').sortable({
			containment: 'parent',
			helper: 'clone',
			cursor: 'ns-resize',
			deactivate: sortfunc
		});
		$('#tEQTthreats').sortable({
			containment: 'parent',
			helper: 'clone',
			cursor: 'ns-resize',
			deactivate: sortfunc
		});

		SizeDOMElements();  // Correct the scroller regions
		$('.projectname').text(this.title);
#ifdef SERVER
		document.title = "Raster - " + this.title;
#endif
	},

	paintTemplates: function() {
		let idir = this.icondata.dir;

		// Template images. The first image of each type will be the default image.
		$('#templates').empty();
		for (const t of Object.keys(Rules.nodetypes)) {
			if (t=='tNOT') continue;
			for (const icn of this.icondata.icons) {
				if (icn.type!=t)  continue;
				$('#templates').append(`
					<div class="template">
						<div class="ui-widget templatelabel">${Rules.shortnodetypes[icn.type]}</div>
						<div id="${icn.type}" class="templatebg">
							<img class="templateicon" src="${idir}/${icn.template}" alt="${Rules.shortnodetypes[icn.type]}">
						</div>
						<img id="tC_${icn.type}" class="tC" src="../img/dropedit.png" alt="edit">
					<div>
				`);
				break;
			}
		}
		$('#templates').append(`
			<div class="template">
				<div class="ui-widget templatelabel">${_("note")}</div>
				<div id="tNOT" class="templatebg">
					<img class="templateicon" src="../img/tNOTicon.png" alt="${_("note")}">
				</div>
			<div>
		`);
		$('#tWLS').attr('title', _("Drag to add a wireless link."));
		$('#tWRD').attr('title', _("Drag to add a wired link (cable)."));
		$('#tEQT').attr('title', _("Drag to add an equipment item."));
		$('#tACT').attr('title', _("Drag to add an actor (someone using this telecom services)."));
		$('#tUNK').attr('title', _("Drag to add an unknown link."));
		$('#tNOT').attr('title', _("Drag to add an area for comments."));
		$('#tC_tWLS').attr('title', _("Click to edit common vulnerabilities for Wireless links."));
		$('#tC_tWRD').attr('title', _("Click to edit common vulnerabilities for Wired links."));
		$('#tC_tEQT').attr('title', _("Click to edit common vulnerabilities for Equipment components."));
		$('#tC_tACT').css('visibility','hidden');
		$('#tC_tUNK').css('visibility','hidden');
		
		$('.templatebg').draggable({
			cursor: 'move',
			helper: 'clone'
		});
	},
	
	iconsoftype: function(typ) {
		let icns = [];
		this.icondata.icons.forEach(ic => {if (ic.type==typ) icns.push(ic);});
		return icns;
	},
	
	strToLabel: function(str) {
		var i = Project.colors.indexOf(str);
		if (i==-1) {
			bugreport("Invalid color code","Project.strToLabel;");
			return "";
		}
		if (i==0)  return "";
		return this.labels[i-1];
	},
	
	_stringify: function(transactionId=null) {
		var data = {};
		data.l=this.title;
		data.g=this.group;
		data.a=this.shared;
		data.s=this.services;
		data.d=this.description;
		data.w=this.date;
		data.t=this.vulns;
		data.c=this.labels;
		data.i=this.iconset;
		data.q=this.wpa;
		if (transactionId!=null) {
			data.r = transactionId;
		}
		return JSON.stringify(data);
	},

	exportstring: function(transactionId=null) {
		var key = LS+'P:'+this.id;
		return key + '\t' + this._stringify(transactionId) + '\n';
	},
	
	store: function() {
		if (this.stub)  return;
		var key = LS+'P:'+this.id;
		localStorage[key] = this._stringify();
	},

#ifdef SERVER
	/* storeOnServer: store a project file onto the server.
	 * The following options can be used:
	 *  auto: (Boolean, default true) if true then do not ask for confirmation
	 *  onUpdate: called when successful
	 *  transactions: (Boolean, default true) of true then also store the transactions list
	 */
	storeOnServer: function(option={}) {
		if (!Preferences.online || GroupSettings.localonly)  return; // No actions when offline
		if (option.auto==null) option.auto = true;
		if (option.transactions==null) option.transactions = true;

		let op, data;
		if (option.transactions) {
			op = 'putproject';
			let transarr = [];
			let tr = this.TransactionBase;
			while (tr!=null) {
				transarr.push({
					id: tr.id,			// UUID-string
					descr: tr.descr,	// String
					prev: tr.prev==null?null:tr.prev.id,	// UUID-string
					undo_data: tr.undo_data,	// object
					do_data: tr.do_data,		// object
					kind: tr.kind,		// String
					chain: tr.chain		// Boolean
				});
				tr = tr.next;
			}
			data = JSON.stringify({
					project: exportProject(this.id),
					transactions: transarr
				},null,' ');
		} else {
			op = 'put';
			data = exportProject(this.id);
		}
		
		let thisp = this;
		let doshare = function() {
			// Note that startWatching() will receive a notification of the change to the transaction list on the server
			$.ajax({
				url: `share.php?op=${op}`+
					'&name=' + urlEncode(thisp.title) +
					'&creator=' + urlEncode(Preferences.creator) +
					'&description=' + urlEncode(escapeNewlines(thisp.description)),
				type: 'POST',
				dataType: 'text',
				data: data,
				success: function(datestamp) {
					// Update the timestamp of the project, as indicated by the server
					thisp.setdate(datestamp);
					if (option.onUpdate) {
						option.onUpdate();
					}
				},
				error: function(jqXHR, textStatus /*, errorThrown*/) {
					if (textStatus=="timeout") {
						Preferences.setonline(false);
						rasterAlert(_("Server is offline"),
							_H("The server appears to be unreachable. The tool is switching to working offline.")
						);
					} else {
						rasterAlert(_("A request to the server failed"),
							_("Could not retrieve the remote project.\nThe server reported:<pre>%%</pre>", H(jqXHR.responseText))
						);
					}
				}
			});
		};
		if (option.auto) {
			doshare();
			return;
		}
		// First, check that no other browser has touched the versions since we last
		// retrieved it.
		Project.getProps(this.title,function(details){
			if (details!=null && (thisp.date=="" || thisp.date < details.date)) {
				thisp.askForConflictResolution(details);
				return;
			} 
			// It is safe to upload the file.
			doshare();
		});
	},

	/* deleteFromServer: remove this project from the server.
	 */
	deleteFromServer: function() {
		if (!Preferences.online || GroupSettings.localonly)  return; // No actions when offline
		var thisp = this;
		Project.getProps(this.title,function(details){
			if (details==null)  return; // Project is not on server

			if (this.date=="") {
				bugreport("Project does not have a date","deleteFromServer");
			}
			if (thisp.date < details.date) {
				rasterAlert(_("Cannot remove project from server"),
					_H("Project '%%' has been stored on the server by user '%%' on '%%'. ", thisp.title, details.creator, details.date)
					+_H("Your project will be made private, so that you can continue using it.\n")
					+_H("Beware: this project has not be saved on the server.")
				);
				thisp.setshared(false,false);
				return;
			}
			$.ajax({
				url: 'share.php?op=del'+
					'&name=' + urlEncode(thisp.title) +
					'&creator=' + urlEncode(details.creator) +
					'&date=' + urlEncode(details.date),
				type: 'POST',
				success: function() {},
				error: function(jqXHR, textStatus /*, errorThrown*/) {
					if (textStatus=="timeout") {
						Preferences.setonline(false);
						rasterAlert(_("Server is offline"),
							_H("The server appears to be unreachable. The tool is switching to working offline.")
						); 
					} else {
						rasterAlert(_("A request to the server failed"),
							_("Could not delete the remote project.\nThe server reported:<pre>%%</pre>", H(jqXHR.responseText))
						);
					}
				}
			});				
		});
	},


	/* refreshIfNecessary(auto,callbacks): replace the local copy of this project by the one stored on the server, if it is newer.
	 * auto is a boolean; when true no confirmation is necessary. When false, a confirmation will be asked before updating.
	 * callbacks is an object containing four possible functions:
	 *	callbacks.onUpdate(newpid): function to call when the project was updated
	 *			successfully. Parameter 'newpid' is the id of the new project.
	 *	callbacks.onNoupdate(): function to call when the server version is the
	 *			the same as or older than this project.
	 *	callbacks.onNotfound(): function to call when the project is not present on
	 *			the server. The project will have been made private.
	 *	callbacks.onError(str): function to call when there was any other error. The
	 *			error message itself is in parameter 'str'.
	 * All callbacks are optional. The default is 'no action'.
	 */
	refreshIfNecessary: function(auto,callbacks={}) {
		if (!this.shared || !Preferences.online) {
			// No actions when offline
			if (callbacks.onNoupdate) {
				callbacks.onNoupdate();
			}
			return;
		}
		if (this.date=="") {
			bugreport("Project has no date","refreshIfNecessary");
		}
		var p = this;
		Project.getProps(this.title,function(props){
			if (props==null) {
				// Not on the server
				p.setshared(false,false);
				if (callbacks.onNotfound) {
					callbacks.onNotfound();
				}
				return;
			}
			// Project is on server. Check remote date
			if (p.date!="" && props.date > p.date) {
				var doUpdate = function(){
					// Duplicate this project, and erase the original before loading the stub so that we have a backup when loading fails.
					let backup = p.duplicate();
					// backup has exactly the same title as p
					backup.settitle(p.title+_(" (backup)"));
					let newp = new Project(createUUID(),true);
					newp.title = props.name;
					newp.creator = props.creator;
					newp.date = props.date;
					newp.description = props.description;
					Project.asyncRetrieveStub(newp.id,
						function(newpid) {
							if (callbacks.onUpdate!=null) callbacks.onUpdate(newpid);
							backup.destroy();
						},
						function(jqXHR /*, textStatus, errorThrown*/) {
							// Old project may or may not have been deleted. Only remove backup if this project still exists.
							p = Project.get(p.id);
							if (p!=null) {
								p.setshared(false,false);
								backup.destroy();
							}
							if (callbacks.onError!=null) callbacks.onError(jqXHR.responseText);
						},
						p.id
					);
				};
				if (auto) {
					// Update without asking permission
					doUpdate();
				} else {
					newRasterConfirm(_("Update project?"),
						_H("There is a more recent version of this project available. ")+
						_H("You should update your project. ")+
						_H("If you want to continue using your own version, you must make it into a private project."),
						_("Make private"),_("Update")
					).done(function() {
						// Make private
						p.setshared(false,false);
					})
					.fail(doUpdate);
				}
			} else {
				// Our local version is more (at least as) recent.
				// No need to do anything special.
				if (callbacks.onNoupdate) {
					callbacks.onNoupdate();
				}
			}
		});
	},
	
	dorefresh: function(auto) {
		var p = this;
		if (this.id!=Project.cid) {
			bugreport("Project.dorefresh called on inactive project","Project.dorefresh");
		}
		this.refreshIfNecessary(auto, {
			onNotfound: function() {
				rasterAlert(_("Project has been made private"),
					_H("Project '%%' has been deleted from the server by someone. ", p.title)+
					_H("Your local version of the project will now be marked as private. ")+
					_H("If you wish to share your project again, you must set its details to 'Shared' yourself.")+
					"<br><p><i>"+
					_H("Your changes are not shared with others anymore.")+
					"</i>"
				);
			},
			onUpdate: function(newpid) {
				switchToProject(newpid);
				var newp = Project.get(newpid);
				Preferences.setcurrentproject(newp.title);
				$('.projectname').text(newp.title);
				startWatchingCurrentProject();
			},
			onNoupdate: function() {
				startWatchingCurrentProject();
			},
			onError: function(str) {
				rasterAlert(_("Project has been made private"),
					_H("Project '%%' could not be retrieved from the server. ", p.title)+
					_H("Your local version of the project will now be marked as private. ")+
					_H("If you wish to share your project again, you must set its details to 'Shared' yourself.")+
					"<br><p><i>"+
					_H("Your changes are not shared with others anymore.")+
					"</i><p>"+
					_("The server reported:<pre>%%</pre>", H(str))
				);
			}
		});
	},
 
	appendCurrentTransaction: function() {
		if (!this.shared) return;
		if (!Preferences.online || GroupSettings.localonly)  return; // No actions when offline
		let tr = this.TransactionCurrent;
		let trobj = {
			id: tr.id,			// UUID-string
			descr: tr.descr,	// String
			prev: tr.prev.id,	// UUID-string
			undo_data: tr.undo_data,	// object
			do_data: tr.do_data,		// object
			kind: tr.kind,		// String
			chain: tr.chain		// Boolean
		};
		let trString = JSON.stringify(trobj,null,' ');
		let thisp = this;
		$.ajax({
			url: 'share.php?op=appendtr&name=' + urlEncode(thisp.title),
			type: 'POST',
			dataType: 'text',
			data: trString,
			success: function() {
				if (!tr.chain) thisp.storeOnServer({auto: true, transactions: false});
			},
			error: function(jqXHR, textStatus /*, errorThrown*/) {
				if (textStatus=="timeout") {
					Preferences.setonline(false);
					rasterAlert(_("Server is offline"),
						_H("The server appears to be unreachable. The tool is switching to working offline.")
					);
				} else {
					console.log(`append transaction failed: ${jqXHR.responseText}`);
//					rasterAlert(_("A request to the server failed"),
//						_("Could not share this action.\nThe server reported:<pre>%%</pre>", H(jqXHR.responseText))
//					);
					Transaction.undo();
				}
			}
		});
	},

	storeBaseTransaction: function() {
		if (!this.shared) return;
		if (!Preferences.online || GroupSettings.localonly)  return; // No actions when offline
		let tr = this.TransactionBase;
		let trobj = {
			id: tr.id,			// UUID-string
			descr: tr.descr,	// String
			prev: (tr.prev ? tr.prev.id : null),	// UUID-string
			undo_data: tr.undo_data,	// object
			do_data: tr.do_data,		// object
			kind: tr.kind,		// String
			chain: tr.chain		// Boolean
		};
		let trString = JSON.stringify(trobj,null,' ');
		let thisp = this;
		$.ajax({
			url: 'share.php?op=puttrs&name=' + urlEncode(thisp.title),
			type: 'POST',
			dataType: 'text',
			data: trString,
			success: function() {
				console.log(`Stored base transaction for project ${this.title}`);
			},
			error: function(jqXHR, textStatus /*, errorThrown*/) {
				if (textStatus=="timeout") {
					Preferences.setonline(false);
					rasterAlert(_("Server is offline"),
						_H("The server appears to be unreachable. The tool is switching to working offline.")
					);
				} else {
					console.log(`storing of base transaction failed: ${jqXHR.responseText}`);
//					rasterAlert(_("A request to the server failed"),
//						_("Could not share this action.\nThe server reported:<pre>%%</pre>", H(jqXHR.responseText))
//					);
				}
			}
		});
	},

	getNewTransactionsFromServer: function() {
		if (!this.shared) return;
		if (!Preferences.online || GroupSettings.localonly)  return; // No actions when offline
		// Get all missing transactions, and apply them in sequence
		let thisp = this;
		$.ajax({
			url: `share.php?op=gettrsfrom&tr=${thisp.TransactionCurrent.id}&name=${urlEncode(thisp.title)}`,
			dataType: 'json',
			success: function(data) {
				// Find the transaction succeeding TransactionHead, apply it and remove it from the list.
				// Repeat until nu transactions remain
				let n = data.findIndex(tr => tr.prev==thisp.TransactionCurrent.id);
				if (n==-1) {
					console.log(`No transaction found succeeding thisp.TransactionCurrent.id`);
					return;
				}
				let tr = data[n];
				// truncate the transactionlist at current
				thisp.TransactionCurrent.next = null;
				this.TransactionHead = thisp.TransactionCurrent;
				// apply all new transactions (normally just 1)
				do {
					new Transaction(tr.kind,tr.undo_data,tr.do_data,tr.descr,tr.chain,true,tr.id);
					tr = tr.next;
				} while (tr!=null);
			},
			error: function(jqXHR, textStatus /*, errorThrown*/) {
				if (textStatus=="timeout") {
					Preferences.setonline(false);
					rasterAlert(_("Server is offline"),
						_H("The server appears to be unreachable. The tool is switching to working offline.")
					);
				} else {
					rasterAlert(_("A request to the server failed"),
						_("Could not share this action.\nThe server reported:<pre>%%</pre>", H(jqXHR.responseText))
					);
				}
			}
		});		
	},
#endif


#ifdef SERVER
	askForConflictResolution: function(details) {
		let proj = this;
		let modaldialog = $('<div id="modaldialog"></div>');

		modaldialog.dialog({
			title: _("Conflict resulution"),
			classes: {"ui-dialog-titlebar": "ui-corner-top"},
			modal:true,
			width: 400,
			height: 'auto',
			maxHeight: 600,
			close: function(/*event, ui*/) { modaldialog.remove(); }
		});
		modaldialog.html(
			_H("A newer version of project '%%' has been stored on the server by user '%%' on '%%'. ", H(proj.title), H(details.creator), H(prettyDate(details.date)))
			+_H("You can continue this version as a private project, overrule the other version so that everyone will use your version, or you can adopt the other version.")
			+"<p>"
			+_H("If you adopt the other version, you may lose some of your latest edits.")
		);

		$('#modaldialog').dialog('option', 'buttons', [
			{text: _("Make private"), click: function(){
				$(this).dialog('close');
				proj.setshared(false,false);
			} },
			{text: _("Overrule"), click: function(){
				$(this).dialog('close');
				proj.setdate(details.date);
				proj.storeOnServer({auto: true}); // auto-save, without asking for confirmation
				startWatchingCurrentProject();
			} },
			{text: _("Adopt other"), click: function(){
				$(this).dialog('close');
				// The contents of 'date' may be stale; the project may have been saved since we
				// created this dialog.
				Project.getProps(proj.title,function(details){
					let backup = proj.duplicate();
					let newp = new Project(createUUID(),true);
					newp.title = proj.title;
					newp.creator = details.creator;
					newp.date = details.date;
					newp.description = details.description;
					Project.asyncRetrieveStub(newp.id,
						function(newpid){
							backup.destroy();
							switchToProject(newpid);
							var t = proj.title;
							Project.get(newpid).settitle(t); // Because the name got '(1)' appended to it.
							startWatchingCurrentProject();
						},
						function () {
							// Old project may or may not have been deleted. Only remove backup if this project stil exists.
							proj= Project.get(proj.id);
							if (proj!=null) {
								proj.setshared(false,false);
								backup.destroy();
							}
						},
						proj.id
					);
				});
			} }
		]);
		$('.ui-dialog-buttonpane button').removeClass('ui-state-focus');
	},
#endif

	internalCheck: function() {
		var errors = "";
		var it;
		let key = LS+'P:'+this.id;
		let lsval = localStorage[key];

		if (!lsval) {
			errors += "Project "+this.id+" is not in local storage.\n";
		}
		if (lsval && lsval!=this._stringify()) {
			errors += "Project "+this.id+" local storage is not up to date.\n";
		}

		if (this.stub && this.services.length>0) {
			errors += "Project "+this.id+" is marked as a stub, but does have services.\n";
		}
		if (!this.stub && this.services.length==0) {
			errors += "Project "+this.id+" is has no services.\n";
		}
		// Check each service, and all nodes in each service
		for (var i=0; i<this.services.length; i++) {
			var s = Service.get(this.services[i]);
			if (!s) {
				errors += "Service "+this.services[i]+" does not exist.\n";
				continue;
			}
			if (s.project != this.id) {
				errors += "Service "+s.id+" belongs to a different project.\n";
			}
			for (var j=0; j<i; j++) {
				if (this.services[i]==this.services[j]) {
					errors += "Service "+s.id+" contains duplicate service "+this.services[i]+".\n";
				}
			}
			// Check all nodes for this service
			it = new NodeIterator({service: s.id});
			for (const rn of it) {
				errors += rn.internalCheck();
			}
		}
		// Check all services that claim to belong to this project
		it = new ServiceIterator({project: this.id});
		for (const s of it) {
			if (this.services.indexOf(s.id)==-1) {
				errors += "Service "+s.id+" claims to belong to project "+this.id+" but is not known as a member.\n";
			}
		}
		// Check all node clusters
		it = new NodeClusterIterator({project: this.id});
		if (this.stub && it.count()>0) {
			errors += "Project "+this.id+" is marked as a stub, but does have node clusters.\n";
		}
		for (const nc of it) {
			if (!nc) {
				errors += "Node cluster "+nc.id+" does not exist.\n";
				continue;
			}
			errors += nc.internalCheck();
			if (nc.isempty()) {
				let a = Assessment.get(nc.assmnt);
				if (a!=null) {
					let v = Vulnerability.get(a.vulnerability);
					if (v==null) errors += `Node cluster ${nc.id} has no valid vulnerability.\n`;
					if (v!=null && !v.common) errors += `Node cluster ${nc.id} is root, but does not have a common vulnerability.\n`;
				}
			}
		}
		// Check all components
		it = new ComponentIterator({project: this.id});
		if (this.stub && it.count()>0) {
			errors += "Project "+this.id+" is marked as a stub, but does have components.\n";
		}
		for (const cm of it) {
			if (!cm) {
				errors += "Component "+it.getcomponentid()+" does not exist.\n";
				continue;
			}
			errors += cm.internalCheck();
		}
		// Check all common vulnerabilities on this project
		if (this.stub && this.vulns.length>0) {
			errors += "Project "+this.id+" is marked as a stub, but does contain Vulnerabilities.\n";
		}
		for (i=0; i<this.vulns.length; i++) {
			let v = Vulnerability.get(this.vulns[i]);
			if (!v) {
				errors += "Vulnerability "+this.vulns[i]+" does not exist.\n";
				continue;
			}
			if (v.project != this.id) {
				errors += "Vulnerability "+v.id+" belongs to a different project.\n";
			}
			if (!v.common) {
				errors += "Project "+this.id+" contains vulnerability "+v.id+" that is not common.\n";
			}
			let it = new NodeClusterIterator({project: this.id, title: v.title, type: v.type, isroot: true});
			if (it.isEmpty()) {
				errors += "Vulnerability "+v.id+" does not have a corresponding node cluster.\n";
			}
			for (j=0; j<i; j++) {
				if (this.vulns[i]==this.vulns[j]) {
					errors += "Project "+this.id+" contains duplicate vulnerability "+this.vulns[i]+".\n";
				}
				let vj = Vulnerability.get(this.vulns[j]);
				if (isSameString(v.title,vj.title) && v.type==vj.type) {
					errors += "Project "+this.id+" contains vulnerability "+v.id+" with the same name and type as "+vj.id+".\n";
				}
			}
		}
		// Check all vulnerabilities
		it = new VulnerabilityIterator({project: this.id});
		if (this.stub && it.count()>0) {
			errors += "Project "+this.id+" is marked as a stub, but does have vulnerabilities.\n";
		}
		for (const v of it) {
			if (v.common && this.vulns.indexOf(v.id)==-1) {
				errors += "Common vulnerability "+v.id+" claims to belong to project "+this.id+" but is not known as a member.\n";
			}
			errors += v.internalCheck();
		}
		
		return errors;
	}

#ifdef UNUSED
	/* storeIfNotPresent(string,callback): store this project on the server without overwriting existing projects
	 *  string: contents of the project (should be exportProject(this.id))
	 *  callback: object containing callback functions:
	 *		onUpdate: called after the project has been stored successfully
	 */
	storeIfNotPresent: function(exportstring,callback={}) {
		if (!Preferences.online || GroupSettings.localonly)  return; // No actions when offline
		var thisp = this;
		// First, check that no other browser has touched the versions since we last
		// retrieved it.
		Project.getProps(this.title,function(details){
			if (details!=null) {
				// Project is on the server
				return;
			}
			// Not yet present, so upload the file.
			$.ajax({
				url: 'share.php?op=put'+
					'&name=' + urlEncode(thisp.title) +
					'&creator=' + urlEncode(Preferences.creator) +
					'&description=' + urlEncode(escapeNewlines(thisp.description)),
				type: 'POST',
				dataType: 'text',
				data: exportstring,
				success: function(datestamp) {
					// Update the timestamp of the project, as indicated by the server
					thisp.setdate(datestamp);
					if (callback.onUpdate) {
						callback.onUpdate();
					}
				},
				error: function(jqXHR, textStatus /*, errorThrown*/) {
					if (textStatus=="timeout") {
						Preferences.setonline(false);
						rasterAlert(_("Server is offline"),
							_H("The server appears to be unreachable. The tool is switching to working offline.")
						);
					} else {
						rasterAlert(_("A request to the server failed"),
							_("Could not retrieve the remote project.\nThe server reported:<pre>%%</pre>", H(jqXHR.responseText))
						);
					}
				}
			});
		});
	},

	/* getDate: retrieve the datetime for this project on the server and update this project's date.
	 *  doWhenReady: function that is called after the date has been updated.
	 */
	getDate: function(doWhenReady) {
		if (!Preferences.online)  return; // No actions when offline
		var thisp = this;
		Project.getProps(this.title,function(props){
			if (props && props.creator==Preferences.creator) {
				thisp.setdate(props.date);
			}
			if (doWhenReady) {
				doWhenReady(props);
			}
		});
	},
#endif

};

#ifdef SERVER
function escapeNewlines(s) {
	// Change backslash to "backslash-!" and newlines to "backslash-n"
	return s.replace(/\\/g,'\\!').replace(/\n/g,'\\n');
}

function unescapeNewlines(s) {
	return s.replace(/\\n/g,'\n').replace(/\\!/g,'\\');
}
#endif

/* mylang(obj): retrieve language specific element from obj.
 *  obj = {'EN': 'English', 'NL': 'Not English'}
 *  mylang('EN') --> 'English'
 *  mylang('NL') --> 'Not English'
 *  mylang('ES') --> undefined
 */
function mylang(obj) {		// eslint-disable-line no-unused-vars
#ifdef SERVER
	var lang = $.localise.defaultLanguage.toLocaleUpperCase();
#else
	var lang = 'EN'; // default
#ifdef LANG_NL
	lang = 'NL';
#endif
#endif

	if (obj[lang]) {
		return obj[lang];
	} else {
		// Fallback from 'en-US' to 'EN'
		lang = lang.replace(/([^_]+)-.+/, "$1");
		return obj[lang];
	}
}
