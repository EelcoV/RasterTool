/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* global nid2id, PaintAllClusters, bugreport, trimwhitespace, _, ProjectIterator, refreshProjectList, startAutoSave, LS */

/*
 *
 */
var PreferencesObject = function() {		// eslint-disable-line no-unused-vars
	this.settheme = function(/*theme*/) {
		/* Obsolete */
	};
	
	this.setlabel = function(labelonoff) {
		this.label = (labelonoff===true);
		if (this.label) {
			$('.nodeheader').removeClass('Chide');
			$('.contentimg').each(function(){
				var rn = Node.get(nid2id(this.parentElement.id));
				var src=$(this).attr('src');
				src = src.replace(/\/img\/iconset\/(\w+)\/.+\//, '/img/iconset/$1/'+rn.color+'/');
				$(this).attr('src', src);
			});
		} else {
			$('.nodeheader').addClass('Chide');
			$('.contentimg').each(function(){
				var src=$(this).attr('src');
				src = src.replace(/\/img\/iconset\/(\w+)\/.+\//, '/img/iconset/$1/none/');
				$(this).attr('src', src);
			});
		}
		if (this.tab==2) {
			PaintAllClusters();
		}
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
			rule.style.top='-3px';
			rule.style.left='1px';
			rule.style.color='transparent';
		} else if (this.emsize=='em_large') {
			rule.style.visibility='visible';
			rule.style.width='20px';
			rule.style.height='15px';
			rule.style.top='-9px';
			rule.style.left='0px';
			rule.style.color='black';
		} else if (this.emsize=='em_none') {
			rule.style.visibility='hidden';
		}
		this.store();
	};

	this.setcurrentproject = function(projectname) {
		this.currentproject = String(projectname);
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
		this.creator = trimwhitespace(String(cr)).substr(0,100);
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
			var it = new ProjectIterator({stubsonly: true});
			for (const p of it) {
				p.destroy();
			}
			refreshProjectList();
		}
		this.store();
		startAutoSave();
	};
	
	this.store = function() {
		var data = {};
		data.theme=this.theme;
		data.label=this.label;
		data.emsize =this.emsize;
		data.currentproject=this.currentproject;
		data.tab=this.tab;
		data.service=this.service;
		data.creator=this.creator;
		data.online=this.online;
		localStorage[LS+'R:0'] = JSON.stringify(data);
	};

	/* Initialisation: set defaults, and allow localStorage to override these.
	 * Don't try to set the current project yet, because it may not have been
	 * loaded.
	 */
	this.currentproject = '';
	this.theme = 'smoothness';
	this.label=true;
	this.emsize = 'small';
	this.tab = 0;
	this.service = 0;
	this.creator = _("Anonymous");
	this.online = true;
	try {
		if (localStorage[LS+'R:0']!=null) {
			var pr = JSON.parse(localStorage[LS+'R:0']);
			if (pr.label!=null) this.setlabel(pr.label);
			if (pr.emsize!=null) this.setemblem(pr.emsize);
			if (pr.currentproject!=null) this.setcurrentproject(pr.currentproject);
			if (pr.tab!=null) this.settab(pr.tab);
			if (pr.service!=null) this.setservice(pr.service);
			if (pr.creator!=null) this.setcreator(pr.creator);
			if (pr.online!=null) this.setonline(pr.online);
		}
	} catch(e) {
		// silently ignore
	}
	this.store();
};

