/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* global
_, Assessment, AssessmentIterator, bugreport, Component, ComponentIterator, createUUID, exportProject, GroupSettings, H, isSameString, loadFromString, LS, mylang, newRasterConfirm, nid2id, NodeCluster, NodeCluster, NodeClusterIterator, populateProjectList, Preferences, prettyDate, ProjectIterator, rasterAlert, Rules, Service, ServiceIterator, SizeDOMElements, startAutoSave, switchToProject, ToolGroup, Transaction, urlEncode, Vulnerability, VulnerabilityIterator
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
 *  merge(target,source): merge source project into target project, deleting source project.
 *	updateStubs(blocking): retrieve list of projects from server.
 *	retrieve(i): download the project with id 'i' from the server.
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
 *  icondata: an object containing information on this iconset.
 *  TransactionBase: the start of the transaction list, a special transaction with kind==null
 *  TransactionCurrent: the most recently performed transaction
 *  TransactionHead: the most recently posted transaction
 *		See rasterTransaction.js for description of these, and the transaction list.
 * Methods:
 *	destroy(): destructor for this object
 *	duplicate(): creates an exact copy of this project, and returns that duplicate. Note: this will create two projects with the samen name.
 *	totalnodes(): returns the count of all nodes within all services of this project.
 *	settitle(t): change the title to 't' (50 chars max). The actual title may receive
 *		a numerical suffix to make it unique.
 *	setshared(b): set sharing status to 'b' (boolean).
 *	setdescription(s): change description to 's'.
 *	setdate(d): change date to 'd'.
 *	autosettitle: choose a unique standard name.
 *		Either settitle() or autosettitle() must be called.
 *	addservice(id,idx): add an existing Service object to this project, at position idx.
 *	removeservice(id): remove and destroy a Service object from this project.
 *  addvulnerability(id,clid,clthrid,idx): add a common vulnerability to the project, including id of new root cluster,
 *		id of the assessment of that cluster, and the index of the vulnerability within vulns[].
 *	removevulnerability(id): remove acommon vulnerability from the project.
 *  defaultassessmentdata(t): returns do/undo data for common vulnerabilities of type t.
 *	unload(): remove all DOM elements for this project.
 *	load(): create and set all DOM elements for this project.
 *	adddefaultvulns: add the predefined checklist vulnerabilities to this project.
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
 *	storeOnServer(): save this project onto the server.
 *  storeIfNotPresent():
 *	deleteFromServer(): remove this project from the server.
 *	getDate(): retrieve last saved date of this project.
 *  refreshIfNecessary():
 *  dorefresh():
 *  updateUndoRedoUI: highlight/lowlight the undo/redo buttons as necessary
 */
var Project = function(id,asstub) {
	if (id!=null && Project._all.has(id)) {
		bugreport("Project with id "+id+" already exists","Project.constructor");
	}
	this.id = (id==null ? createUUID() : id);
	this.title = "?";
	this.group = ToolGroup;
	this.description = "";
	this.services = [];
	this.vulns = [];
	this.labels = Project.defaultlabels;
	this.creator = "";
	this.date = "";
#ifdef SERVER
	this.shared = false;
	if (asstub==null) {
		this.stub = false;
	} else {
		this.stub = (asstub===true);
	}
#else
	this.stub = false;
#endif

	this.iconset = GroupSettings.iconset;
	this.icondata = {};
	var p = this;
	// Load the current iconset
	$.ajax({
		url: '../img/iconset/'+this.iconset+'/iconset.json',
		async: false,
		dataType: 'json',
		success: function(data) {
			p.icondata.setName = data.setName;
			p.icondata.setDescription = mylang(data.setDescription);
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
				if (r.type==null) return; // mandatory
				if (r.image==null) return; // mandatory
				if (Rules.nodetypes[r.type]==null) return; // invalid type
				i.type = r.type;
				i.image = r.image;
				if (r.name!=null) {
					i.name = mylang(r.name);
				} else {
					i.name = r.image;
				}
				if (r.width!=null) i.width = r.width;
				if (r.height!=null) i.height = r.height;
				if (r.title!=null) i.title = r.title;
				if (r.margin!=null) i.margin = r.margin;
				if (r.offsetConnector!=null) i.offsetConnector = r.offsetConnector;
				if (r.maintainAspect!=null) i.maintainAspect = r.maintainAspect;
				if (r.template!=null) {
					i.template = r.template;
				} else {
					i.template = i.image.replace(/(.+)\.(\w+)$/, '$1-template.$2');
				}
				// Precompute the id and name of the mask image
				i.mask = i.image.replace(/(.+)\.(\w+)$/, '$1-mask.$2');
				i.maskid = i.mask.replace(/(.+)\.(\w+)$/, '$1-$2');
				i.iconset = data.setName;
				p.icondata.icons.push(i);
			}
		}
	});

	this.TransactionBase = new Transaction(null,null,null);
	this.TransactionCurrent = this.TransactionBase;
	this.TransactionHead = this.TransactionBase;

	this.store();
	Project._all.set(this.id,this);
};
Project.get = function(id) { return Project._all.get(id); };
Project.cid = 0;
Project._all =new Map();
Project.defaultlabels = [_("Red"), _("Orange"), _("Yellow"), _("Green"), _("Blue"), _("Pink"), _("Purple"), _("Grey")];
Project.colors = ["none","red","orange","yellow","green","blue","pink","purple","grey"];
Project.defaultVulnerabilities = [		// eslint-disable-line no-unused-vars
	/* [ type , title , description ] */
	["tWLS",_("Interference"),		_("Unintentional interference by a radio source using the same frequency band.")],
	["tWLS",_("Jamming"),			_("Intentional interference by some third party.")],
	["tWLS",_("Congestion"),		_("The amount of traffic offered exceeds the capacity of the link.")],
	["tWLS",_("Signal weakening"),	_("Loss of signal strength through distance or blocking by buildings, trees, etc.")],
	["tWRD",_("Break"),				_("Cable damaged by natural events, trenching, anchors, or other external influence.")],
	["tWRD",_("Congestion"),		_("The amount of traffic offered exceeds the capacity of the link.")],
	["tWRD",_("Cable aging"),		_("Insulation weakens with age.")],
	["tEQT",_("Physical damage"),	_("Fire, flood, knocks and other physical damage inflicted.")],
	["tEQT",_("Power"),				_("Failure of electrical power supply.")],
	["tEQT",_("Configuration"),		_("Incorrect configuration or mistakes by operators or users.")],
	["tEQT",_("Malfunction"),		_("Failure of an internal module without a clear external cause, possibly by aging.")]
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

/* Note: this is not a general merge procedure. Project 'intoproject' must be
 * the currently activated project for this to work. This needs a rewrite.
 * Consider:
 *  - do a loadFromString(savedcopy,...)
 *  - transfer the services of the newly created project into 'intoproject'
 *  - cleanly destroy the remnants of the created project
 * This will leave 'otherproject' completely untouched.
 * We can then get rid of s.load() below, and move that functionality into $('#libmerge').on('click',  function() {...})
 */
Project.merge = function(intoproject,otherproject) {
	// Save a copy of the file that is merged
	var savedcopy = exportProject(otherproject.id);
	var saveddate = otherproject.date;
	var i;
	// Move each of the services over, one by one
	for (const sid of otherproject.services) {
		var s = Service.get(sid);
		s.setproject(intoproject.id);
		s.settitle(s.title); // intoproject may already have a service with title s.title
		s.load(); // Because intoproject is currently active.
		intoproject.services.push(s.id);

		var it = new ComponentIterator({service: s.id});
		for (const cm of it) {
			cm.setproject(intoproject.id);
			var it2 = new ComponentIterator({project: intoproject.id, type: cm.type});
			for (const cm2 of it2) {
				if (cm2.id==cm.id) continue;
				if (!isSameString(cm2.title,cm.title)) continue;

				// There is already a component in this project with title cm.title
				// cm needs to be merged into cm2.
				cm2.absorbe(cm);
				break;	// Can occur only once, as cm2.title must be unique in otherproject
			}
		}
		
		// All nodes in this service need to be added to the proper NodeCluster in intoproject
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
				NodeCluster.addnode_threat(intoproject.id,rn.id,ta.title,ta.type,true);
			}
		}
	}

	intoproject.store();
	otherproject.services = [];
	otherproject.destroy();
	// Now resurrect the other project
	i = loadFromString(savedcopy,true,false,'Merge');
	if (i==null) {
		bugreport("Failed to resurrect merged project", "Project.Merge");
	}
	otherproject = Project.get(i);
	otherproject.date = saveddate;

	if (intoproject.shared) {
		intoproject.storeOnServer(false,exportProject(intoproject.id),{});
	}
};

#ifdef SERVER
// Make sure that at most one request runs at any time
// This should not be necessary, but may be useful during debugging.
var updateStubsInProgress=false;

/* Add all projects that can be found on the server, except those that share their name with a
 * project that is shared, as stub projects.
 */
Project.updateStubs = function(doWhenReady) {
	if (!Preferences.online)  return; // No actions when offline
	// Ignore if we already have a request running.
	if (updateStubsInProgress) {
		return;
	}
	updateStubsInProgress=true;
	// Fire off request to server
	$.ajax({
		url: 'share.php?op=list',
		dataType: 'json',
		success: function(data) {
			// Remove all current stub projects
			var it = new ProjectIterator({stub: true});
			it.forEach(p => p.destroy());
			for (const rp of data) {
				// Skip the server version if we are already sharing this project (avoid duplicate)
				var p = Project.withTitle(rp.name);
				if (p!=null && Project.get(p).shared==true) continue;

				p = new Project(null,true);
				p.shared = true;
				p.title = rp.name;
				p.creator = rp.creator;
				p.date = rp.date;
				p.description = unescapeNewlines(rp.description);
			}
			if (doWhenReady) {
				doWhenReady(data);
			}
		},
		error: function(jqXHR, textStatus) {
			if (textStatus=="timeout") {
				Preferences.setonline(false);
				rasterAlert(_("Server is offline"),
					_("The server appears to be unreachable. The tool is switching to working offline.")
				); 
			} else {
				rasterAlert(_("A request to the server failed"),
					_("Could not retrieve the list of remote projects.\nThe server reported:<pre>%%</pre>", jqXHR.responseText)
				);
			}
		},
		complete: function() {
			updateStubsInProgress=false;
		}
	});
};

var retrieveInProgress=false;

Project.retrieve = function(pid,doWhenReady,doOnError) {
	if (!Preferences.online)  return; // No actions when offline
	if (retrieveInProgress)  return;

	var p = Project.get(pid);
	if (!p.stub) {
		bugreport("Retrieving a project that is not a stub","Project.retrieve");
		return;
	}
	retrieveInProgress =true;
	$.ajax({
		url: 'share.php?op=get'+
			'&name=' + urlEncode(p.title) +
			'&creator=' + urlEncode(p.creator) +
			'&date=' + urlEncode(p.date),
		dataType: 'text',
		success: function (data) {
			var newp = loadFromString(data,true,false,'Remote project');
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
						_("An invalid project was received from the server.")
					);
				}
			}
		},
		error: function(jqXHR, textStatus, errorThrown) {
			if (textStatus=="timeout") {
				Preferences.setonline(false);
				rasterAlert(_("Server is offline"),
					_("The server appears to be unreachable. The tool is switching to working offline.")
				);
				if (doOnError) {
					doOnError(jqXHR, textStatus, errorThrown);
				}
			} else {
				if (doOnError) {
					doOnError(jqXHR, textStatus, errorThrown);
				} else {
					rasterAlert(_("A request to the server failed"),
						_("Could not retrieve the remote project.\nThe server reported:<pre>%%</pre>", jqXHR.responseText)
					);
				}
			}
		},
		complete: function() {
			retrieveInProgress = false;
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
					_("The server appears to be unreachable. The tool is switching to working offline.")
				); 
			} else {
				rasterAlert(_("A request to the server failed"),
					_("Could not retrieve properties the remote project.\nThe server reported:<pre>%%</pre>", jqXHR.responseText)
				);
			}
		},
		complete: function() {
		}
	});
};
#endif

Project.prototype = {
	destroy: function() {
		this.unload();
		for (const sid of this.services) Service.get(sid).destroy();
		var it = new NodeClusterIterator({project: this.id});
		it.forEach(nc => nc.destroy());
		for (const vid of this.vulns) Vulnerability.get(vid).destroy();
		localStorage.removeItem(LS+'P:'+this.id);
		Project._all.delete(this.id);
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

	totalnodes: function() {
//		var total=0;
		let it = new NodeIterator({project: this.id});
//		for (const rn of it) total++;		// eslint-disable-line no-unused-vars
//		return total;
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
		if (GroupSettings.nostore) {
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
				this.storeOnServer(false,exportProject(this.id),{});
			} else {
				// Project was shared, now becomes private.
				this.deleteFromServer();
			}
		}
		this.shared = newstatus;
		this.store();
		startAutoSave();
	},
#endif

	setdescription: function(s) {
		this.description = String(s).trim().substr(0,100);
		this.store();
	},
	
	setdate: function(d) {
		this.date = String(d).trim().substr(0,20);
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
			vln.setdescription(dv[2]);
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
				freq: '-',
				impact: '-',
				remark: ''
			});
		}
		return arr;
	},

	seticonset: function(iconset) {
		this.iconset = iconset;
		this.store();
	},

	unload: function() {
		// Save the selectrect
		$('#selectrect').hide().detach().appendTo('body');
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
		
		this.services.forEach(sid => Service.get(sid).load());
		for (const vid of this.vulns) {
			let vln = Vulnerability.get(vid);
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

		var pid = this.id;
		var sortfunc = function(/*event,ui*/) {
			var p = Project.get(pid);
			var newlist = [];
			$('#tWLSthreats .threat').each( function(index,elem) {
				newlist.push( nid2id(elem.id) );
			});
			$('#tWRDthreats .threat').each( function(index,elem) {
				newlist.push( nid2id(elem.id) );
			});
			$('#tEQTthreats .threat').each( function(index,elem) {
				newlist.push( nid2id(elem.id) );
			});
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

		// Mask images
		$('#mask-collection').empty();
		for (const r of this.icondata.icons) $('#mask-collection').append('<img class="mask" id="'+r.maskid+'" src="../img/iconset/'+r.iconset+'/'+r.mask+'">');

		// Template images. The first image of each type will be the default image.
		$('#templates').empty();
		var icns = this.icondata.icons;
		for (const t of Object.keys(Rules.nodetypes)) {
			for (const icn of icns) {
				if (icn.type!=t)  continue;
				var str = '\
					<div class="template">\n\
						<div class="ui-widget templatelabel">_TN_</div>\n\
						<div id="_TY_" class="templatebg">\n\
							<img class="templateicon" src="../img/iconset/_IS_/_IT_">\n\
						</div>\n\
						<img id="tC__TY_" class="tC" src="../img/dropedit.png">\n\
					<div>\
				';
				str =str.replace(/_TY_/g, icn.type);
				str =str.replace(/_TN_/g, Rules.nodetypes[icn.type]);
				str =str.replace(/_IS_/g, icn.iconset);
				str =str.replace(/_IM_/g, icn.image);
				str =str.replace(/_IT_/g, icn.template);
				$('#templates').append(str);
				// See comments in raster.css at nodecolorbackground
				$('#tbg_'+icn.type).css('-webkit-mask-image', 'url(../img/iconset/'+icn.iconset+'/'+icn.mask+')');
				$('#tbg_'+icn.type).css('-webkit-mask-image', '-moz-element(#'+icn.maskid+')');
				break;
			}
		}
		$('#tWLS').attr('title', _("Drag to add a wireless link."));
		$('#tWRD').attr('title', _("Drag to add a wired link (cable)."));
		$('#tEQT').attr('title', _("Drag to add an equipment item."));
		$('#tACT').attr('title', _("Drag to add an actor (someone using this telecom services)."));
		$('#tUNK').attr('title', _("Drag to add an unknown link."));
		$('#tNOT').attr('title', _("Drag to add an area for comments."));
		$('#tC_tWLS').attr('title', _("Click to edit common vulnerabilities for Wireless links."));
		$('#tC_tWRD').attr('title', _("Click to edit common vulnerabilities for Wired links."));
		$('#tC_tEQT').attr('title', _("Click to edit common vulnerabilities for Equipment components."));

		$('.templatebg').draggable({
			cursor: 'move',
			helper: 'clone'
		});

		SizeDOMElements();  // Correct the scroller regions
		$('.projectname').text(this.title);
#ifdef SERVER
		populateProjectList();
		$('#projlist').find(`option[value=${this.id}]`).attr("selected",true);
		$('#projlist-button span:last-child').html( H(this.title) );
		$('#projlist').selectmenu('refresh');	// this will trigger a select event on the selectmenu
		document.title = "Raster - " + this.title;
#endif
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
	
	_stringify: function() {
		var data = {};
		data.l=this.title;
		data.g=this.group;
		data.a=this.shared;
		data.s=this.services;
		data.d=this.description;
		data.w=this.date;
		data.t=this.vulns;
		data.c=this.labels;
		return JSON.stringify(data);
	},

	exportstring: function() {
		var key = LS+'P:'+this.id;
		return key + '\t' + this._stringify() + '\n';
	},
	
	store: function() {
		if (this.stub)  return;
		var key = LS+'P:'+this.id;
		localStorage[key] = this._stringify();
	},

#ifdef SERVER
	storeOnServer: function(auto,exportstring,callback) {
		if (!Preferences.online || GroupSettings.nostore)  return; // No actions when offline
		var thisp = this;
		// First, check that no other browser has touched the versions since we last
		// retrieved it.
		Project.getProps(this.title,function(details){
			if (details!=null && (thisp.date=="" || thisp.date < details.date) && !auto) {
				askForConflictResolution(thisp,details);
				return;
			} 
			// It is safe to upload the file.
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
							_("The server appears to be unreachable. The tool is switching to working offline.")
						); 
					} else {
						rasterAlert(_("A request to the server failed"),
							_("Could not retrieve the remote project.\nThe server reported:<pre>%%</pre>", jqXHR.responseText)
						);
					}
				}
			});
		});
	},

	storeIfNotPresent: function(exportstring,callback) {
		if (!Preferences.online || GroupSettings.nostore)  return; // No actions when offline
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
							_("The server appears to be unreachable. The tool is switching to working offline.")
						); 
					} else {
						rasterAlert(_("A request to the server failed"),
							_("Could not retrieve the remote project.\nThe server reported:<pre>%%</pre>", jqXHR.responseText)
						);
					}
				}
			});
		});
	},

	deleteFromServer: function() {
		if (!Preferences.online || GroupSettings.nostore)  return; // No actions when offline
		var thisp = this;
		Project.getProps(this.title,function(details){
			if (details==null)  return; // Project is not on server

			if (this.date=="") {
				bugreport("Project does not have a date","deleteFromServer");
			}
			if (thisp.date < details.date) {
				rasterAlert(_("Cannot remove project from server"),
					_("Project '%%' has been stored on the server by user '%%' on '%%'. ", H(thisp.title), H(details.creator), H(details.date))
					+_("Your project will be made private, so that you can continue using it.\n")
					+_("Beware: this project has not be saved on the server.")
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
							_("The server appears to be unreachable. The tool is switching to working offline.")
						); 
					} else {
						rasterAlert(_("A request to the server failed"),
							_("Could not delete the remote project.\nThe server reported:<pre>%%</pre>", jqXHR.responseText)
						);
					}
				}
			});				
		});
	},
	
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
	
	/* auto is a boolean; when true no confirmation is necessary. When false, a
	 *			confirmation will be asked before updating. 
	 * callbacks is an object containing three possible functions:
	 *	callbacks.onUpdate(newpid): function to call when the project was updated
	 *			successfully. Parameter 'newpid' is the id of the new project.
	 *	callbacks.onNoupdate(): function to call when the server version is the
	 *			the same as or older than this project.
	 *	callbacks.onNotfound(): function to call when the project is not present on
	 *			the server. The project will have been made private.
	 *	callbacks.onError(str): function to call when there was any other error. The
	 *			error message itself is in parameter 'str'.
	 * All callbacks are optional, but the callbacks object is not. The default is 'no action'.
	 */
	refreshIfNecessary: function(auto,callbacks) {
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
					var newp = new Project(null,true);
					newp.shared = true;
					newp.title = props.name;
					newp.creator = props.creator;
					newp.date = props.date;
					newp.description = props.description;
					Project.retrieve(newp.id,
						callbacks.onUpdate,
						function(jqXHR /*, textStatus, errorThrown*/) {
							p.setshared(false,false);
							if (callbacks.onError) {
								callbacks.onError(jqXHR.responseText);
							}
					});
				};
				if (auto) {
					// Update without asking permission
					doUpdate();
				} else {
					newRasterConfirm(_("Update project?"),
						_("There is a more recent version of this project available. ")+
						_("You should update your project. ")+
						_("If you want to continue using this version, you must make it into a private project."),
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
					_("Project '%%' has been deleted from the server by someone. ", H(p.title))+
					_("Your local version of the project will now be marked as private. ")+
					_("If you wish to share your project again, you must set it's details to 'Shared' yourself.")+
					"<br><p><i>"+
					_("Your changes are not shared with others anymore.")+
					"</i>"
				);
			},
			onUpdate: function(newpid) {
				switchToProject(newpid);
				var t = p.title;
				p.destroy();
				var newp = Project.get(newpid);
				newp.settitle(t); // Because the name got '(1)' appended to it.
				Preferences.setcurrentproject(t);
				$('.projectname').text(newp.title);
				startAutoSave();
			},
			onNoupdate: function() {
				startAutoSave();
			},
			onError: function(str) {
				rasterAlert(_("Project has been made private"),
					_("Project '%%' could not be retrieved from the server. ", H(p.title))+
					_("Your local version of the project will now be marked as private. ")+
					_("If you wish to share your project again, you must set it's details to 'Shared' yourself.")+
					"<br><p><i>"+
					_("Your changes are not shared with others anymore.")+
					"</i><p>"+
					_("The server reported:<pre>%%</pre>", str)
				);
			}
		});
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
//		for (const nc of it) {
//			if (!nc) {
//				errors += "Node cluster "+nc.id+" does not exist.\n";
//				continue;
//			}
//			errors += nc.internalCheck();
//		}
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
			errors += "Project "+this.id+" is marked as a stub, but does have a vulns array.\n";
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
			let it = new NodeClusterIterator({project: this.id, title: v.title, type: v.type, isroot: true});
			if (it.isEmpty()) {
				errors += "Vulnerability "+v.id+" does not have a corresponding node cluster.\n";
			}

		}
		// Check all vulnerabilities
		it = new VulnerabilityIterator({project: this.id});
		if (this.stub && it.count()>0) {
			errors += "Project "+this.id+" is marked as a stub, but does have common vulnerabilities.\n";
		}
		for (const v of it) errors += v.internalCheck();

		return errors;
	}
};

function escapeNewlines(s) {
	// Change backslash to "backslash-!" and newlines to "backslash-n"
	return s.replace(/\\/g,'\\!').replace(/\n/g,'\\n');
}

function unescapeNewlines(s) {
	return s.replace(/\\n/g,'\n').replace(/\\!/g,'\\');
}

#ifdef SERVER
function askForConflictResolution(proj,details) {
	$('#modaldialog').dialog('option', 'buttons', [
	{text: _("Make private"), click: function(){
		$(this).dialog('close'); 
		proj.setshared(false,false);
	} },
	{text: _("Overrule"), click: function(){
		$(this).dialog('close');
		proj.setdate(details.date);
		proj.storeOnServer(true,exportProject(proj.id),{}); // auto-save, without asking for confirmation
		startAutoSave();
	} },
	{text: _("Adopt other"), click: function(){
		$(this).dialog('close'); 
		// The contents of 'date' may be stale; the project may have been saved since we
		// created this dialog.
		Project.getProps(proj.title,function(details){
			var newp = new Project(null,true);
			newp.shared = true;
			newp.title = proj.title;
			newp.creator = details.creator;
			newp.date = details.date;
			newp.description = details.description;
			Project.retrieve(newp.id,function(newpid){
				switchToProject(newpid);
				var t = proj.title;
				proj.destroy();
				Project.get(newpid).settitle(t); // Because the name got '(1)' appended to it.
				startAutoSave();
			});
		});
	} }
	]);
	$('#modaldialog').dialog( 'option', 'title', _("Conflict resulution"));
	$('#modaldialog').html(
		_("A newer version of project '%%' has been stored on the server by user '%%' on '%%'. ", H(proj.title), H(details.creator), H(prettyDate(details.date)))
		+_("You can continue this version as a private project, overrule the other version so that everyone will use this version, or you can adopt the other version.")
		+"<p>"
		+_("If you adopt the other version, you may lose some of your latest edits.")
	);
	$('#modaldialog').dialog('open');
	$('.ui-dialog-buttonpane button').removeClass('ui-state-focus');
}
#endif

