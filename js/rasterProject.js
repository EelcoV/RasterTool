/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * $Id: rasterProject.js,v 1.1.1.1.4.2.2.2.2.6 2013/07/18 19:52:23 vriezekolke Exp $
 *
 * Project: object representing a project
 *
 * Class variables (those prefixed with underscore should not be accessed from outside)
 *	cid: integer ID of the currently active project
 *	_all: array of all projects, indexed on project ID
 *	get(i): returns the object with id 'i'.
 *	withTitle(str): returns the id of the local project with title 'str', or 'null' otherwise.
 *	firstProject(): returns the an existing local Project object, or null otherwise.
 *  merge(target,source): merge source project into target project, deleting source project.
 *	updateStubs(blocking): retrieve list of projects from server.
 *	retrieve(i): download the project with id 'i' from the server.
 *	getProps(s): retrieve properties of remote project with name 's'.
 * Instance properties:
 *	id: (integer) unique ID of the project
 *	title: (string) short name of the project
 *  shared: (boolean) true iff the project is shared, and stored on the server.
 *	description: free-form description (max 100 chars).
 *	services[]: list of service IDs of all services belonging to this project. Empty for stubs.
 *	threats[]: list of all checklist threats belonging to this project. Empty for stubs.
 *	creator: (string) creator, as returned by the server. Only used for stubs.
 *	date: (string) date, as returned by the server. Only used for stubs.
 *	stub: (boolean) true iff this is a stub.
 * Methods:
 *	destroy(): destructor for this object
 *	totalnodes(): returns the count of all nodes within all services of this project.
 *	settitle(t): change the title to 't' (50 chars max). The actual title may receive
 *		a numerical suffix to make it unique.
 *	setshared(b): set sharing status to 'b' (boolean).
 *	setdescription(s): change description to 's'.
 *	setdate(d): change date to 'd'.
 *	autosettitle: choose a unique standard name.
 *		Either settitle() or autosettitle() must be called.
 *	addservice(id,title): add an existing Service object to this project.
 *	removeservice(id): remove and destroy a Service object from this project.
 *  addthreat(id): add a checklist threat to the project.
 *	removethreat(id): remove a checklist threat from the project.
 *	unload(): remove all DOM elements for this project.
 *	load(): create and set all DOM elements for this project.
 *	adddefaultthreats: add the predefined checklist threats to this project.
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
 *	storeOnServer(): save this project onto the server.
 *	deleteFromServer(): remove this project from the server.
 *	getDate(): retrieve last saved date of this project.
 */
var Project = function(id,asstub) {
	if (id!=null && Project._all[id]!=null)
		bugreport("Project with id "+id+" already exists","Project.constructor");
	this.id = (id==null ? nextUnusedIndex(Project._all) : id);
	this.title = "?";
	this.shared = false;
	this.description = "";
	this.services = [];
	this.threats = [];
	this.labels = Project.defaultlabels;
	this.creator = "";
	this.date = "";
	if (asstub==null)
		this.stub = false;
	else
		this.stub = (asstub===true);

	this.store();
	Project._all[this.id]=this;
};
Project.get = function(id) { return Project._all[id]; };
Project.cid = 0;
Project._all = [];
Project.defaultlabels = [_("Red"), _("Orange"), _("Yellow"), _("Green"), _("Blue"), _("Purple"), _("Grey")];

Project.withTitle = function(str) {
	var found=false;
	for (var i=0; !found && i<Project._all.length; i++) {
		if (Project._all[i]!=null && !Project._all[i].stub)
			found=(Project._all[i].title==str);
	}
	return (found ? i-1 : null);
};

Project.firstProject = function() {
	var i=0;
	while (i<Project._all.length && (Project._all[i]==null || Project._all[i].stub)) i++;
	if (i==Project._all.length)
		return 0;
	else
		return Project._all[i];
};

Project.merge = function(intoproject,otherproject) {
	// Save a copy of the file that is merged
	var savedcopy = exportProject(otherproject.id);
	// Move each of the services over, one by one
	for (var i=0; i<otherproject.services.length; i++) {
		var s = Service.get(otherproject.services[i]);
		// Change the service, and create its DOM elements.
		s.setproject(intoproject.id);
		s.settitle(s.title);
		s.load();
		intoproject.services.push(s.id);

		var it = new ComponentIterator({service: s.id});
		for (it.first(); it.notlast(); it.next()) {
			var cm = it.getcomponent();
			cm.setproject(intoproject.id);
			var it2 = new ComponentIterator({project: intoproject.id, type: cm.type});
			for (it2.first(); it2.notlast(); it2.next()) {
				var cm2 = it2.getcomponent();
				if (cm2.id==cm.id) continue;
				if (cm2.title!=cm.title) continue;
				// There is already a component in this project with title cm.title
				// cm needs to be merged into cm2.
				cm2.absorbe(cm);
				break;	// Can occur only once, as cm2.title must be unique in otherproject
			}
		}
		
		// All nodes in this service need to be added to the proper NodeCluster in intoproject
		it = new NodeIterator({service: s.id});
		for (it.first(); it.notlast(); it.next()) {
			var rn = it.getnode();
			if (rn.type=='tACT' || rn.type=='tNOT')
				continue;
			cm = Component.get(rn.component);
			// If the node was added to a singular component, it doesn't need to added
			if (cm.single)
				continue;
			for (var j=0; j<cm.thrass.length; j++) {
				var ta = ThreatAssessment.get(cm.thrass[j]);
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
	otherproject = loadFromString(savedcopy,true,false,'Merge');
	if (otherproject==null)
		bugreport("Failed to resurrect merged project", "Project.Merge");
};

// Make sure that at most one request runs at any time
// This should not be necessary, but may be useful during debugging.
var updateStubsInProgress=false;

/* Add all projects that can be found on the server, except those that share their name with a
 * project that is shared, as stub projects.
 */
Project.updateStubs = function(doWhenReady) {
	if (!Preferences.online) return; // No actions when offline
	// Ignore if we already have a request running.
	if (updateStubsInProgress)
		return;
	updateStubsInProgress=true;
	// Fire off request to server
	$.ajax({
		url: 'share.php?op=list',
		dataType: 'json',
		success: function(data,x,y,z) {
			// Remove all current stub projects
			var it = new ProjectIterator({stubsonly: true});
			for (it.first(); it.notlast(); it.next()) {
				it.getproject().destroy();
			}
			for (var i=0; i<data.length; i++) {
				var rp = data[i];
				// Skip the server version if we are already sharing this project (avoid duplicate)
				var p = Project.withTitle(rp.name);
				if (p!=null && Project.get(p).shared==true)
					continue;
				p = new Project(null,true);
				p.shared = true;
				p.title = rp.name;
				p.creator = rp.creator;
				p.date = rp.date;
				p.description = rp.description;
			}
			if (doWhenReady)
				doWhenReady(data);
		},
		error: function(jqXHR, textStatus, errorThrown) {
			if (textStatus=="timeout") {
				Preferences.setonline(false);
				rasterAlert(_("Server is offline"),
					_("The server appears to be unreachable. The tool is switching to working offline.")
				); 
			} else
				rasterAlert(_("A request to the server failed"),
					_("Could not retrieve the list of remote projects.\nThe server reported:<pre>%%</pre>", jqXHR.responseText)
				);
		},
		complete: function() {
			updateStubsInProgress=false;
		}
	});
};

var retrieveInProgress=false;

Project.retrieve = function(pid,doWhenReady,doOnError) {
	if (!Preferences.online) return; // No actions when offline
	if (retrieveInProgress)
		return;
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
//			p.destroy();
			var newp = loadFromString(data,true,false,'Remote project');
			if (newp!=null) {
				var np = Project.get(newp);
				np.date = p.date;
				np.shared = true;
				np.store();
				if (doWhenReady)
					doWhenReady(newp);
			} else {
				// Retrieve succeeded, but it still counts as an error because no valid project was found.
				// Duplicate the code for 'error:' below
				if (doOnError) {
					var jqXHR = {responseText: "Invalid project received from server."};
					doOnError(jqXHR, jqXHR.responseText, jqXHR.responseText);
				} else
					rasterAlert(_("Invalid project received from server"),
						 _("An invalid project was received from the server.")
					);
			}
		},
		error: function(jqXHR, textStatus, errorThrown) {
			if (textStatus=="timeout") {
				Preferences.setonline(false);
				rasterAlert(_("Server is offline"),
					_("The server appears to be unreachable. The tool is switching to working offline.")
				);
				if (doOnError)
					doOnError(jqXHR, textStatus, errorThrown);
			} else {
				if (doOnError)
					doOnError(jqXHR, textStatus, errorThrown);
				else
					rasterAlert(_("A request to the server failed"),
						_("Could not retrieve the remote project.\nThe server reported:<pre>%%</pre>", jqXHR.responseText)
					);
			}
		},
		complete: function() {
			retrieveInProgress = false;
		}
	});
};

Project.getProps = function(pname,doWhenReady) {
	if (!Preferences.online) return; // No actions when offline
	$.ajax({
		url: 'share.php?op=getprops'+'&name=' + urlEncode(pname),
		dataType: 'json',
		success: function (data) {
			if (doWhenReady)
				doWhenReady(data);
		},
		error: function(jqXHR, textStatus, errorThrown) {
			if (textStatus=="timeout") {
				Preferences.setonline(false);
				rasterAlert(_("Server is offline"),
					_("The server appears to be unreachable. The tool is switching to working offline.")
				); 
			} else
				rasterAlert(_("A request to the server failed"),
					 _("Could not retrieve properties the remote project.\nThe server reported:<pre>%%</pre>", jqXHR.responseText)
				);
		},
		complete: function() {
		}
	});
};

Project.prototype = {
	destroy: function() {
		//this.unload();
//		$('#libselect option[value='+this.id+']').remove();
//		$('#projloader option[value='+this.id+']').remove();
		for (var i=0; i<this.threats.length; i++)
			Threat.get(this.threats[i]).destroy();		
		for (i=0; i<this.services.length; i++)
			Service.get(this.services[i]).destroy();
		var it = new NodeClusterIterator({project: this.id});
 		for (it.first(); it.notlast(); it.next())
 			it.getNodeCluster().destroy();
		localStorage.removeItem(LS+'P:'+this.id);
		Project._all[this.id]=null;
	},
	
	totalnodes: function() {
		var total=0;
		var it = new NodeIterator({project: this.id});
		for (it.first(); it.notlast(); it.next()) total++;
		return total;
	},
	
	settitle: function(newtitle) {
		newtitle = trimwhitespace(String(newtitle)).substr(0,50);
		if (newtitle==this.title) return;
		if (newtitle=='') return;
		var targettitle = newtitle;
		if (Project.withTitle(targettitle)!=null) {
			var n=0;
			do 
				targettitle = newtitle + " (" + (++n) + ")";
			while (Project.withTitle(targettitle)!=null);
		}
		this.title = targettitle;
		this.store();
	},

	autosettitle: function() {
		this.settitle(_("New project"));
	},

	setshared: function(b,updateServer) {
		var newstatus = (b===true);
		if (this.shared==newstatus)
			return;
		if (updateServer==undefined || updateServer==true) {
			if (newstatus==true) {
				var thisp = this;
				// Project was private, now becomes shared.
				this.storeOnServer(false,exportProject(this.id),{});
			} else 
				// Project was shared, now becomes private.
				this.deleteFromServer();
		}
		this.shared = newstatus;
		this.store();
		startAutoSave();
	},
	
	setdescription: function(s) {
		this.description = trimwhitespace(String(s)).substr(0,100);
		this.store();
	},
	
	setdate: function(d) {
		this.date = trimwhitespace(String(d)).substr(0,20);
		this.store();
	},
	
	addservice: function(id) {
		var s = Service.get(id);
		if (this.services.indexOf(s.id)!=-1)
			bugreport("service already added","Project.addservice");
		s.setproject(this.id);
		this.services.push(s.id);
		this.store();
	},
	
	removeservice: function(id) {
		var s = Service.get(id);
		if (this.services.indexOf(s.id)==-1)
			bugreport("no such service","Project.removeservice");
		this.services.splice( jQuery.inArray(s.id,this.services),1 );
		s.destroy();
		this.store();
	},

	addthreat: function(id) {
		var th = Threat.get(id);
		if (this.threats.indexOf(th.id)!=-1)
			bugreport("threat already added","Project.addthreat");
		th.setproject(this.id);
		this.threats.push(th.id);
		this.store();
	},
	
	removethreat: function(id) {
		var th = Threat.get(id);
		if (this.threats.indexOf(th.id)==-1)
			bugreport("no such threat","Project.removethreat");
		this.threats.splice( jQuery.inArray(th.id,this.threats),1 );
		th.destroy();
		this.store();
	},
	
	unload: function() {
		for (var i=0; i<this.services.length; i++) {
			Service.get( this.services[i] ).unload();
		}
		$('#tWLSthreats').empty();
		$('#tWRDthreats').empty();
		$('#tEQTthreats').empty();
		$('.projectname').empty();
	},

	load: function() {
		for (var i=0; i<this.services.length; i++) {
			var s = Service.get( this.services[i] );
			s.load();
		}
		for (i=0; i<this.threats.length; i++) {
			var th = Threat.get( this.threats[i] );
			switch (th.type) {
			case "tWLS":
				th.addtablerow("#tWLSthreats");
				break;
			case "tWRD":
				th.addtablerow("#tWRDthreats");
				break;
			case "tEQT":
				th.addtablerow("#tEQTthreats");
				break;
			default:
				bugreport('unknown type encountered','Project.load'); 
			}
		}

		var pid = this.id;
		var sortfunc = function(e,ui) {
			var p = Project.get(pid);
			var newlist = [];
			$("#tWLSthreats .threat").each( function(index,elem) {
				newlist.push( nid2id(elem.id) );
			});
			$("#tWRDthreats .threat").each( function(index,elem) {
				newlist.push( nid2id(elem.id) );
			});
			$("#tEQTthreats .threat").each( function(index,elem) {
				newlist.push( nid2id(elem.id) );
			});
			if (newlist.length != p.threats.length)
				bugreport("internal error in sorting default vulnerabilities","Project.load");
			p.threats = newlist;
			transactionCompleted("Project threats reordered "+pid);
		};
		$("#tWLSthreats").sortable({
			containment: "parent",
			helper: "clone",
			cursor: "ns-resize",
			deactivate: sortfunc
		});
		$("#tWRDthreats").sortable({
			containment: "parent",
			helper: "clone",
			cursor: "ns-resize",
			deactivate: sortfunc
		});
		$("#tEQTthreats").sortable({
			containment: "parent",
			helper: "clone",
			cursor: "ns-resize",
			deactivate: sortfunc
		});

		$('.projectname').text(this.title);
		Project.cid = this.id;
		Service.cid = this.services[0];
// Do not paint, because we may want to show a tab other than the diagram
//		Service.get(Service.cid).paintall();
		Preferences.setcurrentproject(this.title);
	},
	
	adddefaultthreats: function() {
		for (var i=0; i<DefaultThreats.length; i++) {
			var th = new Threat(DefaultThreats[i][0]);
			th.setproject(this.id);
			th.settitle(DefaultThreats[i][1]);
			th.setdescription(DefaultThreats[i][2]);
			this.addthreat(th.id);
		}
	},


	strToLabel: function(str) {
		switch (str) {
		case "none":
			return "";
		case "red":
			return this.labels[0];
		case "orange":
			return this.labels[1];
		case "yellow":
			return this.labels[2];
		case "green":
			return this.labels[3];
		case "blue":
			return this.labels[4];
		case "purple":
			return this.labels[5];
		case "grey":
			return this.labels[6];
		default:
			bugreport("Invalid color code","Project.strToLabel;");
			return "";
		}
	},
	
	_stringify: function() {
		var data = {};
		data.l=this.title;
		data.a=this.shared;
		data.s=this.services;
		data.d=this.description;
		data.w=this.date;
		data.t=this.threats;
		data.c=this.labels;
		return JSON.stringify(data);
	},

	exportstring: function() {
		var key = LS+'P:'+this.id;
		return key + '\t' + this._stringify() + '\n';
	},
	
	store: function() {
		if (this.stub)
			return;
		var key = LS+'P:'+this.id;
		localStorage[key] = this._stringify();
	},
	
	storeOnServer: function(auto,exportstring,callback) {
		if (!Preferences.online) return; // No actions when offline
		var thisp = this;
		// First, check that no other browser has touched the versions since we last
		// retrieved it.
		Project.getProps(this.title,function(details){
			if (details!=null && (thisp.date=="" || thisp.date < details.date) && !auto) {
				askForConflictResolution(thisp,details);
//				rasterAlert('Cannot store project on server',
//					'A newer version of project "'+H(thisp.title)+'" has been stored on the server by user "'+H(details.creator)+'" on '+H(prettyDate(details.date))+'. '
//					+'This project will now be made private, so that you can continue using it.\n'
//					+'<p><i>This project is not shared with others</i>.'
//				);
//				thisp.setshared(false,false);
				return;
			} 
			// It is safe to upload the file.
			$.ajax({
				url: 'share.php?op=put'+
					'&name=' + urlEncode(thisp.title) +
					'&creator=' + urlEncode(Preferences.creator) +
					'&description=' + urlEncode(thisp.description),
				type: 'POST',				
				dataType: 'text',
				data: exportstring,
				success: function(datestamp) {
					// Update the timestamp of the project, as indicated by the server
					thisp.setdate(datestamp);
					if (callback.onUpdate)
						callback.onUpdate();
				},
				error: function(jqXHR, textStatus, errorThrown) {
					if (textStatus=="timeout") {
						Preferences.setonline(false);
						rasterAlert(_("Server is offline"),
							_("The server appears to be unreachable. The tool is switching to working offline.")
						); 
					} else
						rasterAlert(_("A request to the server failed"),
							 _("Could not retrieve the remote project.\nThe server reported:<pre>%%</pre>", jqXHR.responseText)
						);
				}
			});
		});
	},

	storeIfNotPresent: function(exportstring,callback) {
		if (!Preferences.online) return; // No actions when offline
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
					'&description=' + urlEncode(thisp.description),
				type: 'POST',				
				dataType: 'text',
				data: exportstring,
				success: function(datestamp) {
					// Update the timestamp of the project, as indicated by the server
					thisp.setdate(datestamp);
					if (callback.onUpdate)
						callback.onUpdate();
				},
				error: function(jqXHR, textStatus, errorThrown) {
					if (textStatus=="timeout") {
						Preferences.setonline(false);
						rasterAlert(_("Server is offline"),
							_("The server appears to be unreachable. The tool is switching to working offline.")
						); 
					} else
						rasterAlert(_("A request to the server failed"),
							 _("Could not retrieve the remote project.\nThe server reported:<pre>%%</pre>", jqXHR.responseText)
						);
				}
			});
		});
	},

	deleteFromServer: function() {
		if (!Preferences.online) return; // No actions when offline
		var thisp = this;
		Project.getProps(this.title,function(details){
			if (details==null)
				// Project is not on server
				return;
			if (this.date=="")
				bugreport("Project does not have a date","deleteFromServer");
//			if (thisp.date!="" && thisp.date < details.date) {
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
//					'&creator=' + urlEncode(Preferences.creator) +
					'&creator=' + urlEncode(details.creator) +
					'&date=' + urlEncode(details.date),
				type: 'POST',
				success: function() {},
				error: function(jqXHR, textStatus, errorThrown) {
					if (textStatus=="timeout") {
						Preferences.setonline(false);
						rasterAlert(_("Server is offline"),
							_("The server appears to be unreachable. The tool is switching to working offline.")
						); 
					} else
						rasterAlert(_("A request to the server failed"),
							_("Could not delete the remote project.\nThe server reported:<pre>%%</pre>", jqXHR.responseText)
						);
				}
			});				
		});
	},
	
	getDate: function(doWhenReady) {
		if (!Preferences.online) return; // No actions when offline
		var thisp = this;
		Project.getProps(this.title,function(props){
			if (props && props.creator==Preferences.creator)
				thisp.setdate(props.date);
			if (doWhenReady)
				doWhenReady(props);
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
			if (callbacks.onNoupdate)
				callbacks.onNoupdate();
			return;
		}
		if (this.date=="")
			bugreport("Project has no date","refreshIfNecessary");
		var p = this;
		Project.getProps(this.title,function(props){
			if (props==null) {
				// Not on the server
				p.setshared(false,false);
				if (callbacks.onNotfound)
					callbacks.onNotfound();
			} else {
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
							function(jqXHR, textStatus, errorThrown) {
								p.setshared(false,false);
								if (callbacks.onError)
									callbacks.onError(jqXHR.responseText);
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
					if (callbacks.onNoupdate)
						callbacks.onNoupdate();
				}
			}
		});
	},
	
	dorefresh: function(auto) {
		var p = this;
		if (this.id!=Project.cid)
			bugreport("Project.dorefresh called on inactive project","Project.dorefresh");
		this.refreshIfNecessary(auto, {
			onNotfound: function(){
				rasterAlert(_("Project has been made private"),
					_("Project '%%' has been deleted from the server by someone. ", H(p.title))+
					_("Your local version of the project will now be marked as private. ")+
					_("If you wish to share your project again, you must set it\'s details to 'Shared' yourself.")+
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
					_("If you wish to share your project again, you must set it\'s details to 'Shared' yourself.")+
					"<br><p><i>"+
					_("Your changes are not shared with others anymore.")+
					"</i><p>"+
					_("The server reported:<pre>%%</pre>", str)
				);
			}
		});
	},

	internalCheck: function() {
		var errors = "";
		var it;
		if (this.stub && this.services.length>0)
			errors += "Project is marked as a stub, but does have services.\n";
		if (!this.stub && this.services.length==0)
			errors += "Project is has no services.\n";
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
			for (it.first(); it.notlast(); it.next()) {
				var rn = it.getnode();
				errors += rn.internalCheck();
			}
		}
		// Check all services that claim to belong to this project
		it = new ServiceIterator({project: this.id});
  		for (it.first(); it.notlast(); it.next()) {
 			s = it.getservice();
 			if (this.services.indexOf(s.id)==-1)
 				errors += "Service "+s.id+" claims to belong to project "+this.id+" but is not known as a member.\n";
 				
  		}
		// Check all node clusters
		it = new NodeClusterIterator({project: this.id});
		if (this.stub && it.notlast())
			errors += "Project is marked as a stub, but does have node clusters.\n";
  		for (it.first(); it.notlast(); it.next()) {
 			var nc = it.getNodeCluster();
			if (!nc) {
				errors += "Node cluster "+it.getNodeClusterid()+" does not exist.\n";
				continue;
			}
			errors += nc.internalCheck();
  		}
		// Check all components
		it = new ComponentIterator({project: this.id});
		if (this.stub && it.notlast())
			errors += "Project is marked as a stub, but does have components.\n";
  		for (it.first(); it.notlast(); it.next()) {
 			var cm = it.getcomponent();
			if (!cm) {
				errors += "Component "+it.getcomponentid()+" does not exist.\n";
				continue;
			}
			errors += cm.internalCheck();
  		}
		// Check all threats on this project
		if (this.stub && this.threats.length>0)
			errors += "Project is marked as a stub, but does have a threats array.\n";
		for (i=0; i<this.threats.length; i++) {
			var t = Threat.get(this.threats[i]);
			if (!t) {
				errors += "Threat "+this.threats[i]+" does not exist.\n";
				continue;
			}
			if (t.project != this.id) {
				errors += "Threat "+t.id+" belongs to a different project.\n";
			}
		}
		// Check all threats
		it = new ThreatIterator(this.id,'tUNK');
		if (this.stub && it.notlast())
			errors += "Project is marked as a stub, but does have threats.\n";
  		for (it.first(); it.notlast(); it.next()) {
 			t = it.getthreat();
			if (!t) {
				errors += "Component "+it.getthreatid()+" does not exist.\n";
				continue;
			}
  		}
		return errors;
	}
};


function askForConflictResolution(proj,details) {
	$('#modaldialog').dialog("option", "buttons", [
	{text: _("Make private"), click: function(){
		$(this).dialog("close"); 
		proj.setshared(false,false);
	} },
	{text: _("Overrule"), click: function(){
		$(this).dialog("close");
		proj.setdate(details.date);
		proj.storeOnServer(true,exportProject(proj.id),{}); // auto-save, without asking for confirmation
		startAutoSave();
	} },
	{text: _("Adopt other"), click: function(){
		$(this).dialog("close"); 
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
	$('#modaldialog').dialog( "option", "zIndex", 9999 );
	$('#modaldialog').dialog( "option", "title", _("Conflict resulution"));
	$('#modaldialog').html(
		_("A newer version of project '%%' has been stored on the server by user '%%' on '%%'. ", H(proj.title), H(details.creator), H(prettyDate(details.date)))
		+_("You can continue this version as a private project, overrule the other version so that everyone will use this version, or you can adopt the other version.")
		+"<p>"
		+_("If you adopt the other version, you may lose some of your latest edits.")
	);
	$('#modaldialog').dialog("open");
	$('.ui-dialog-buttonpane button').removeClass('ui-state-focus');
}


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * ProjectIterator: iterate over all projects
 *
 * usage:
 * 		var it = new ProjectIterator({shared: true});
 *		it.sortByTitle();
 * 		for (it.first(); it.notlast(); it.next()) {
 *			var p = it.getproject();
 *	 		:
 *		}
 * Options:
 *	title: title matches string
 *	shared: only projects with this sharing status. Default: both shared and non-shared.
 *	stubsonly: true: only stubs, false: all projects. Undefined: only non-stubs.
 */
var ProjectIterator = function(opt) {
	this.index = 0;
	this.item = [];
	for (var i=0; i<Project._all.length; i++) {
		if (Project._all[i]==null) continue;
		var p =  Project._all[i];
		var ok = true;
		if (opt && opt.title!=null) {
			ok = ok && (p.title===opt.title);
		}
		if (opt && opt.shared!=null) {
			ok = ok && (p.shared===opt.shared);
		}
		if (opt && opt.stubsonly==null) {
			ok = ok && (p.stub==false);
		} else {
			ok = ok && (p.stub || !(opt && opt.stubsonly));
		}
		if (ok)
			this.item.push(i);
	}
};
ProjectIterator.prototype = {
	first: function() {this.index=0;},
	next: function() {this.index++;},
	number: function() {return this.item.length;},
	notlast: function() {return (this.index < this.item.length);},
	getprojectid: function() {return this.item[this.index];},
	getproject: function() {return Project.get( this.item[this.index] );},
	sortByTitle: function() {
		this.item.sort( function(a,b) {
			var pa = Project.get(a);
			var pb = Project.get(b);
			return pa.title.toLocaleLowerCase().localeCompare(pb.title.toLocaleLowerCase());
		});
	}
};

