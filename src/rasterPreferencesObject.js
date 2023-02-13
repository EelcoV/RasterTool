/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* global bugreport, _, ProjectIterator, refreshStubList, startWatchingCurrentProject, LS, ToolGroup, Service */

/*
 *
 */
var PreferencesObject = function() {		// eslint-disable-line no-unused-vars
	this.setlabel = function(labelonoff) {
		this.label = (labelonoff===true);
		if (this.label) {
			$('.nodeheader').removeClass('Hhide');
			$('.nodecolorbackground').removeClass('Bhide');
			$('.ncontentimg').removeClass('Ihide');
		} else {
			$('.nodeheader').addClass('Hhide');
			$('.nodecolorbackground').addClass('Bhide');
			$('.ncontentimg').addClass('Ihide');
		}
		$('#label_off').prop('checked',!this.label);
		$('#label_on').prop('checked',this.label);
		$('input[name=labelonoff]').checkboxradio('refresh');
//		let p = Project.get(Project.cid);
//		p.services.forEach(sid => paintSingleFailures(Service.get(sid)));
//		PaintAllClusters();
		this.store();
	};
	
	this.setmap = function(maponoff) {
		this.showmap = (maponoff===true);
		if (this.showmap) {
			$('#scroller_overview'+Service.cid).show();
		} else {
			$('.scroller_overview').hide();
		}
		$('#showmap_off').prop('checked',!this.showmap);
		$('#showmap_on').prop('checked',this.showmap);
		$('input[name=showmap]').checkboxradio('refresh');
		this.store();
	};

	this.setemblem = function(emsize) {
		this.emsize = emsize;
		/* Find a CSS-rule with the exact name 'div.nodeMagnitude', then
		 * modify that rule on the fly.
		 */
		var css=document.getElementById('maincssfile').sheet;
		var rule=null;
		for (const r of css.cssRules) {
			if (r.selectorText=='div.nodeMagnitude') {
				rule = r;
				break;
			}
		}
		if (!rule) {
			bugreport('cannot locate css rule for emblem size','PreferencesObject.setemblem');
			return;
		}
		if (this.emsize=='em_small') {
			rule.style.visibility='visible';
			rule.style.width='8px';
			rule.style.height='8px';
			rule.style.top='-4px';
			rule.style.left='-4px';
			rule.style.color='transparent';
		} else if (this.emsize=='em_large') {
			rule.style.visibility='visible';
			rule.style.width='20px';
			rule.style.height='15px';
			rule.style.top='-10px';
			rule.style.left='-15px';
			rule.style.color='black';
		} else if (this.emsize=='em_none') {
			rule.style.visibility='hidden';
		}
		$('#'+this.emsize).prop('checked',true);
		$('input[name=emblem_size]').checkboxradio('refresh');
		this.store();
	};

	this.setcurrentproject = function(projectname) {
		this.currentproject = projectname;
		this.store();
	};

	this.settab = function(tab) {
		this.tab = tab;
		this.store();
	};

	this.setservice = function(str) {
		this.service = str;
		this.store();
	};

	this.setcreator = function(cr) {
		this.creator = String(cr).trim().substr(0,100);
		if (this.creator=='') {
			this.creator=_("Anonymous");
		}
		this.store();
	};
	
	this.setonline = function(o) {
		var newstatus = (o===true);
		if (this.online==newstatus) {
			return;
		}
		this.online = newstatus;
		if (!this.online) {
			$('#networkactivity').removeClass('activityyes activityno').addClass('activityoff');
			// Remove all current stub projects
			var it = new ProjectIterator({group: ToolGroup, stub: true});
			it.forEach(p => p.destroy());
			refreshStubList();
		}
		this.store();
		startWatchingCurrentProject();
	};
	
	this.store = function() {
		var data = {};
		data.label=this.label;
		data.emsize =this.emsize;
		data.currentproject=this.currentproject;
		data.tab=this.tab;
		data.service=this.service;
		data.creator=this.creator;
		data.online=this.online;
		data.showmap=this.showmap;
		localStorage[LS+'R:0'] = JSON.stringify(data);
	};

	/* Initialisation: set defaults, and allow localStorage to override these.
	 * Don't try to set the current project yet, because it may not have been
	 * loaded.
	 */
	this.currentproject = '';
	this.label=true;
	this.emsize = 'em_small';
	this.tab = 0;
	this.service = '';
	this.creator = _("Anonymous");
	this.online = true;
	this.showmap = true;
	try {
		if (localStorage[LS+'R:0']!=null) {
			var pr = JSON.parse(localStorage[LS+'R:0']);
			if (pr.label!=null) this.label = pr.label;
			if (pr.emsize!=null) this.emsize = pr.emsize;
			if (pr.currentproject!=null) this.currentproject = pr.currentproject;
			if (pr.tab!=null) this.tab = pr.tab;
			if (pr.service!=null) this.service = pr.service;
			if (pr.creator!=null) this.creator = pr.creator;
			if (pr.online!=null) this.online = pr.online;
			if (pr.showmap!=null) this.showmap = pr.showmap;
		}
	} catch(e) {
		// silently ignore
	}
	this.store();
};

