<!DOCTYPE html>
<!-- 
Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
See LICENSE.md
 -->
<html>

<head>
#ifdef SERVER
<meta name="group" content="<?= GROUP ?>">
#endif
<meta http-equiv="Content-Type" content="text/html;charset=utf-8" >
<meta charset="UTF-8"> 
<title>Raster - Risk Assessment of Telecoms Services</title>
<!-- First stylesheet must be the one that is a custom setting. -->
<link rel="stylesheet" href="../css/theme/jquery-ui.min.css" class="ui-theme">
<link rel="stylesheet" href="../css/raster.css" type="text/css" id="maincssfile">
<link rel="stylesheet" href="../css/raster-print.css" type="text/css">
<link rel="shortcut icon" href="../img/Raster.png">
#ifdef STANDALONE
  <script type="text/javascript">if (typeof module === 'object') {window.module = module; module = undefined;}</script>
#endif
<script type="text/javascript" src="../js/jquery-3.6.0.min.js"></script>
<script type="text/javascript" src="../js/jquery-ui-1.13.0.min.js"></script>
#ifdef SERVER
<script type="text/javascript" src="../js/jquery.localisation.js"></script>
#endif
<script type="text/javascript" src="../js/jsplumb-2.12.0.min.js"></script>
<script type="text/javascript" src="../js/jquery.editinplace-2.2.1.js"></script>
<script type="text/javascript" src="../js/encodedecode.js"></script>
#ifdef SERVER
<script type="text/javascript">$.localise('../js/translation', {async: false, language: "<?= LANGUAGE ?>".replace(/(;.+)/,'').replace(/,.+/,'')});</script>
#else
#ifdef LANG_NL
  <script src="../js/translation-nl.js"></script>
#endif
#endif
<script type="text/javascript" src="../js/rasterMain.js"></script>
<script type="text/javascript" src="../js/rasterTransaction.js"></script>
<script type="text/javascript" src="../js/rasterProject.js"></script>
<script type="text/javascript" src="../js/rasterService.js"></script>  
<script type="text/javascript" src="../js/rasterVulnerability.js"></script>
<script type="text/javascript" src="../js/rasterAssessment.js"></script>
<script type="text/javascript" src="../js/rasterComponent.js"></script>
<script type="text/javascript" src="../js/rasterNode.js"></script>  
<script type="text/javascript" src="../js/rasterNodeCluster.js"></script>
<script type="text/javascript" src="../js/rasterIterators.js"></script>
<script type="text/javascript" src="../js/rasterPreferencesObject.js"></script>
#ifdef STANDALONE
  <script type="text/javascript">if (window.module) module = window.module;</script>
#endif

<style type="text/css">
.fullscreen {
    position: absolute;
    width: 100%;
    height: 100%;
    background: grey;
    opacity: 0.95;
    z-index: 9998;
    left: 0;
    top: 0;
}
.fullscreen p {
    color: white;
    text-align: center;
    font-size: 18pt;
    font-family: "Lucida Sans Unicode", "Lucida Grande", sans-serif;
}
</style>
</head>

<!-- all strings xyz are placeholders, replaced by text in the correct language -->
<body>
<div id="splash" class="fullscreen">
 <p style="font-size: 28pt;">Raster</p>
 <p>Risk Assessment of Telecommunication Services</p>
 <p><small><span id="splashstatus">please wait . . .</span></small></p>
</div>

<div id="toolbars" class="donotprint">
	<ul>
		<li><a href="#tb_projects">xyz</a></li>
		<li><a href="#tb_home">xyz</a></li>
		<li><a href="#tb_settings">xyz</a></li>
	</ul>

	<div id="tb_projects" class="toolbar">
		<!-- On current project -->
		<div class="toolbarspacer"></div>
		<div id="buttadd" class="toolbarlargeiconbutton"></div>
		<div id="buttduplicate" class="toolbarlargeiconbutton"></div>
		<input id="fileElem" type="file">
		<div id="buttimport" class="toolbarlargeiconbutton"></div>
		<div id="buttexport" class="toolbarlargeiconbutton"></div>
		<!-- On selected project -->
		<div id="projselected" class="toolbarsection">
			<div id="projlistsection" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<select name="projlist" id="projlist">
					<option>xyz</option>
					</select>
				</div>
			</div>
			<div id="buttactivate" class="toolbarlargeiconbutton"></div>
			<div id="buttdel" class="toolbarlargeiconbutton"></div>
			<div id="buttmerge" class="toolbarlargeiconbutton"></div>
		</div>
		<div id="projdebug" class="toolbarsection">
			<div id="projdebugsection" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<div class="toolbarspacer"></div>
					<div class="toolbarspacer"></div>
					<div id="buttcheck" class="toolbarbutton">xyz</div>
					<div id="buttexportall" class="toolbarbutton">xyz</div>
					<div id="buttzap" class="toolbarbutton">xyz</div>
					<div id="networkactivity" class="toolbariconbutton"></div>
				</div>
			</div>
		</div>
	</div>

	<div id="tb_home" class="toolbar">
		<!-- Common toolbar items -->
		<div class="toolbarspacer"></div>
		<div id="undobutton" class="toolbariconbutton"></div>
		<div id="redobutton" class="toolbariconbutton"></div>
		<div class="toolbarspacer"></div>
		<div id="findbutton" class="toolbariconbutton"></div>
		<div id="helpbutton" class="toolbariconbutton"></div>
		<!-- Diagrams tab -->
		<div id="diaopts" class="toolbarsection">
			<div id="templates"> <!-- Is filled in Project.load() --></div>
		</div>
		<!-- Single failures tab -->
		<div id="sfopts" class="toolbarsection">
			<div id="sffoldsection" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<div id="sfcollapseall" class="toolbarbutton">xyz</div>
					<div id="sfexpandall" class="toolbarbutton">xyz</div>
				</div>
			</div>

			<div class="toolbarspacer"></div>
			<div id="sfsortsection" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<fieldset>
						<input type="radio" id="sfsort_alph" name="sfsort" value="alph"><label for="sfsort_alph">xyz</label>
						<input type="radio" id="sfsort_type" name="sfsort" value="type"><label for="sfsort_type">xyz</label>
						<input type="radio" id="sfsort_thrt" name="sfsort" value="thrt"><label for="sfsort_thrt">xyz</label>
					</fieldset>
				</div>
			</div>
		 </div>
		<!-- Common cause failures tab -->
		<div id="ccfopts" class="toolbarsection">
			<div id="ccffoldsection" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<div id="ccfcollapseall" class="toolbarbutton">xyz</div>
					<div id="ccfexpandall" class="toolbarbutton">xyz</div>
				</div>
			</div>

			<div class="toolbarspacer"></div>
			<div id="ccfsortsection" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<fieldset>
						<input type="radio" id="ccfsort_alph" name="ccfsort" value="alph"><label for="ccfsort_alph">xyz</label>
						<input type="radio" id="ccfsort_type" name="ccfsort" value="type"><label for="ccfsort_type">xyz</label>
						<input type="radio" id="ccfsort_thrt" name="ccfsort" value="thrt"><label for="ccfsort_thrt">xyz</label>
					</fieldset>
				</div>
			</div>
		</div>
		<!-- Analysis tab - Failures and Vulnerabilities -->
		<div id="anavulnopts" class="toolbarsection">
			<div id="anavnsortsection" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<fieldset>
						<input type="radio" id="ana_nodesort_alph" name="ana_nodesort"><label for="ana_nodesort_alph">xyz</label>
						<input type="radio" id="ana_nodesort_type" name="ana_nodesort"><label for="ana_nodesort_type">xyz</label>
						<input type="radio" id="ana_nodesort_thrt" name="ana_nodesort"><label for="ana_nodesort_thrt">xyz</label>
					</fieldset>
				</div>
			</div>
			<div class="toolbarspacer"></div>
			<div id="anavfsortsection" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<fieldset>
						<input type="radio" id="ana_failsort_alph" name="ana_failsort"><label for="ana_failsort_alph">xyz</label>
						<input type="radio" id="ana_failsort_type" name="ana_failsort"><label for="ana_failsort_type">xyz</label>
					</fieldset>
				</div>
			</div>
			<div class="toolbarspacer"></div>
			<div id="anavexcludesection" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<div id="quickwinslink" class="toolbarbutton">xyz</div>
					<div id="clearexclusions" class="toolbarbutton">xyz</div>
				</div>
			</div>
		</div>
		<!-- Analysis tab - Longlist -->
		<div id="anallopts" class="toolbarsection">
			<div id="anallincsection" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<input type="checkbox" id="incX" checked><label for="incX">xyz</label><br>
					<input type="checkbox" id="incA" checked><label for="incA">xyz</label>
				</div>
			</div>
			<div class="toolbarspacer"></div>
			<div id="anallminsection" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<select id="minV"></select>
				</div>
			</div>
		</div>
	</div>

	<div id="tb_settings" class="toolbar">
		<div class="toolbarspacer"></div>
		<div id="vulnlevelsection" class="toolbarlabel">
			<div>xyz</div>
			<div>
				<fieldset>
					<input type="radio" id="em_none"  name="emblem_size" value="em_none"><label for="em_none" >xyz</label>
					<input type="radio" id="em_small" name="emblem_size" value="em_small"><label for="em_small">xyz</label>
					<input type="radio" id="em_large" name="emblem_size" value="em_large"><label for="em_large">xyz</label>
				</fieldset>
			</div>
		</div>

		<div class="toolbarspacer"></div>
		<div id="labelsection" class="toolbarlabel">
			<div>xyz</div>
			<div>
				<fieldset>
					<input type="radio" id="label_off" name="labelonoff"><label for="label_off">xyz</label>
					<input type="radio" id="label_on"  name="labelonoff"><label for="label_on" >xyz</label>
				</fieldset>
			</div>
		</div>
		
		<div class="toolbarspacer"></div>
		<div id="mapsection" class="toolbarlabel">
			<div>xyz</div>
			<div>
				<fieldset>
					<input type="radio" id="showmap_off" name="showmap" value="off"><label for="showmap_off">xyz</label>
					<input type="radio" id="showmap_on"  name="showmap" value="on" ><label for="showmap_on" >xyz</label>
				</fieldset>
			</div>
		</div>
		
		<div id="projectpropsection" class="toolbarsection">
			<div class="toolbarspacer"></div>
			<div id="projectprops" class="toolbarlargeiconbutton"></div>
			<div class="toolbarspacer"></div>
			<div id="buttlabels" class="toolbariconbutton"></div>
		</div>

		<div id="onlinesection" class="toolbarsection">
			<div class="toolbarspacer"></div>
			<div id="creatorlabel" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<input type="text" id="creatorf" placeholder="xyz">
				</div>
			</div>
			<div class="toolbarspacer"></div>
			<div id="onlinelabel" class="toolbarlabel">
				<div>xyz</div>
				<div>
					<fieldset>
						<input type="radio" id="online_off" name="onlineonoff"><label for="online_off">xyz</label>
						<input type="radio" id="online_on"  name="onlineonoff"><label for="online_on" >xyz</label>
					</fieldset>
				</div>
			</div>
		</div>
	</div>

	<div id="classroom" class="ui-widget donotprint"></div>
	<div id="currentProject" class="ui-widget projectname donotprint"></div>
</div>

<div id="workspace">
	<ul id="workspacetabs">
		<li><a href="#tab_diagrams">xyz</a></li>
		<li><a href="#tab_singlefs">xyz</a></li>
		<li class="longtab"><a href="#tab_ccfs" class="longlink">xyz</a></li>
		<li><a href="#tab_analysis">xyz</a></li>
	</ul>


	<div id="tab_diagrams" class="workbody tabs-bottom">
		<!-- div id="mask-collection" class="donotprint"></div -->
		<div id="selectrect">
			<img id="selectrectC" class="nodeC" src="../img/dropdown.png">
		</div>
		<input id="servaddbuttondia" class="servplusbutton" type="button" value=" + ">
		<ul id="bottomtabsdiagrams">
		</ul>
	</div>


	<div id="tab_singlefs" class="workbody tabs-bottom">
		<input id="servaddbuttonsf" class="servplusbutton" type="button" value=" + ">
		<ul id="bottomtabssinglefs">
		</ul>
	</div>


	<div id="tab_ccfs" class="workbody">
		<div id="ccfs_body" class="workbody ui-widget-content"></div>
		<div id="ccfs_details" class="workbody ui-widget-content"></div>
	</div>


	<div id="tab_analysis" class="workbody tabs-bottom">
		<ul id="bottomtabsana">
			<li class="longtab"><a class="longlink" href="#at1">xyz</a></li>
			<li class="longtab"><a class="longlink" href="#at2">xyz</a></li>
			<li class="longtab"><a class="longlink" href="#at3">xyz</a></li>
			<li class="longtab"><a class="longlink" href="#at4">xyz</a></li>
			<li class="longtab"><a class="longlink" href="#at5">xyz</a></li>
		</ul>
		<div id="at1" class="workspace plainworkspace"></div>
		<div id="at2" class="workspace plainworkspace"></div>
		<div id="at3" class="workspace plainworkspace"></div>
		<div id="at4" class="workspace plainworkspace"></div>
		<div id="at5" class="workspace plainworkspace"></div>
	</div>
</div> <!-- id="workspace" -->

<div id="vtabs" class="donotprint"><!-- empty overflow region --></div>
<div id="htabs" class="donotprint"><!-- empty overflow region --></div>

#ifdef STANDALONE
<div id="pdfoptions">
    <div id="pdf_orientation" class="controlgroup">
        <span class="pdflabel ui-widget ui-state-default">xyz</span>
        <fieldset>
            <input type="radio" name="pdf_orientation" id="paperorientation_portrait"><label id="label_portrait" for="paperorientation_portrait">xyz</label>
            <input type="radio" name="pdf_orientation" id="paperorientation_landscape"><label id="label_landscape" for="paperorientation_landscape">xyz</label>
        </fieldset>
    </div>
    <div id="pdf_papersize" class="controlgroup">
        <span class="pdflabel ui-widget ui-state-default">xyz</span>
        <fieldset>
            <input type="radio" name="pdf_papersize" id="papersize_a4"><label for="papersize_a4">A4</label>
            <input type="radio" name="pdf_papersize" id="papersize_a3"><label for="papersize_a3">A3</label>
        </fieldset>
    </div>
    <div id="pdf_scale" class="controlgroup">
        <span class="pdflabel ui-widget ui-state-default">xyz</span>
        <fieldset>
            <input type="radio" name="pdf_scale" id="pdfscale_40"><label for="pdfscale_40">40</label>
            <input type="radio" name="pdf_scale" id="pdfscale_50"><label for="pdfscale_50">50</label>
            <input type="radio" name="pdf_scale" id="pdfscale_60"><label for="pdfscale_60">60</label>
            <input type="radio" name="pdf_scale" id="pdfscale_70"><label for="pdfscale_70">70</label>
            <input type="radio" name="pdf_scale" id="pdfscale_80"><label for="pdfscale_80">80</label>
            <input type="radio" name="pdf_scale" id="pdfscale_90"><label for="pdfscale_90">90</label>
            <input type="radio" name="pdf_scale" id="pdfscale_100"><label for="pdfscale_100">100</label>
        </fieldset>
    </div>
</div>
#endif

<div id="helppanel">
    <div id="helptabs">
        <ul>
            <li><a href="xyz">xyz</a></li>
            <li><a href="xyz">xyz</a></li>
            <li><a href="xyz">xyz</a></li>
            <li><a href="xyz">xyz</a></li>
            <li><a href="xyz">xyz</a></li>
        </ul>
    </div>
</div>

<ul id="nodemenu">
    <li class="lcT"><div><span>xyz</span></div></li>
    <li id="mi_th"><div><span>xyz</span></div></li>
	<li id="mi_ci"><div><span>xyz</span></div>
	 <ul id="mi_cism"></ul>
	</li>
    <li id="mi_ct"><div><span>xyz</span></div>
     <ul id="mi_ctsm">
      <li id="mi_cttWLS"><div><span>xyz</span></div></li>
      <li id="mi_cttWRD"><div><span>xyz</span></div></li>
      <li id="mi_cttEQT"><div><span>xyz</span></div></li>
      <li id="mi_cttACT"><div><span>xyz</span></div></li>
      <li id="mi_cttUNK"><div><span>xyz</span></div></li>
     </ul>
	</li>
    <li id="mi_cl"><div><span>xyz</span></div>
     <ul id="mi_clsm">
      <li id="mi_rc"><div><span>xyz</span></div></li>
      <li id="mi_sx"><div><span>xyz</span></div></li>
      <li id="mi_sm"><div><span>xyz</span></div></li>
     </ul>
	</li>
    <li id="mi_du"><div><span>xyz</span></div></li>
    <li id="mi_cc"><div><span>xyz</span></div>
     <ul id="mi_ccsm">
      <li id="mi_ccnone"><div><div class="noneblock Bnone"><img src="../img/nolabel.png"></div><span>xyz</span></div></li>
      <li id="mi_ccred"><div><div class="smallblock Bred"></div><span>xyz</span></div></li>
      <li id="mi_ccorange"><div><div class="smallblock Borange"></div><span>xyz</span></div></li>
      <li id="mi_ccyellow"><div><div class="smallblock Byellow"></div><span>xyz</span></div></li>
      <li id="mi_ccgreen"><div><div class="smallblock Bgreen"></div><span>xyz</span></div></li>
      <li id="mi_ccblue"><div><div class="smallblock Bblue"></div><span>xyz</span></div></li>
      <li id="mi_ccpink"><div><div class="smallblock Bpink"></div><span>xyz</span></div></li>
      <li id="mi_ccpurple"><div><div class="smallblock Bpurple"></div><span>xyz</span></div></li>
      <li id="mi_ccgrey"><div><div class="smallblock Bgrey"></div><span>xyz</span></div></li>
      <li id="mi_ccedit"><div><span>xyz</span></div></li>
     </ul>
	</li>
    <li id="mi_de"><div><span>xyz</span><span class="ui-icon ui-icon-trash"></div></li>
</ul>
<ul id="selectmenu">
    <li class="lcT"><div><span>xyz</span></div></li>
	<li id="mi_sc"><div><span>xyz</span></div>
		<ul id="mi_scsm">
			<li id="mi_scnone"><div><div class="noneblock Bnone"><img src="../img/nolabel.png"></div><span>xyz</span></div></li>
			<li id="mi_scred"><div><div class="smallblock Bred"></div><span>xyz</span></div></li>
			<li id="mi_scorange"><div><div class="smallblock Borange"></div><span>xyz</span></div></li>
			<li id="mi_scyellow"><div><div class="smallblock Byellow"></div><span>xyz</span></div></li>
			<li id="mi_scgreen"><div><div class="smallblock Bgreen"></div><span>xyz</span></div></li>
			<li id="mi_scblue"><div><div class="smallblock Bblue"></div><span>xyz</span></div></li>
			<li id="mi_scpink"><div><div class="smallblock Bpink"></div><span>xyz</span></div></li>
			<li id="mi_scpurple"><div><div class="smallblock Bpurple"></div><span>xyz</span></div></li>
			<li id="mi_scgrey"><div><div class="smallblock Bgrey"></div><span>xyz</span></div></li>
			<li id="mi_scedit"><div><span>xyz</span></div></li>
		</ul>
	</li>
	<li id="mi_sd"><div><span>xyz</span><span class="ui-icon ui-icon-trash"></div></li>
</ul>
<ul id="ccfmenu">
    <li class="lcT"><div><span>xyz</span></div></li>
	<li id="mi_ccfc"><div><span>xyz</span></div></li>
	<li id="mi_ccfm"><div><span>xyz</span></div>
	 <ul id="mi_ccfmsm">
	 </ul>
	</li>
</ul>

<div id="nodereport" class="nodereport"></div>
<div id="componentthreats" class="componentthreats"></div>
<div id="modaldialog"></div>

<div id="checklist_tWLS" class="checklist">
    <div class="threat"><div class="th_name th_col thr_header">xyz</div><div class="th_descr th_col thr_header">xyz</div></div>
    <div id="tWLSthreats" class="threats">
    </div>
</div>
<div id="checklist_tWRD" class="checklist">
    <div class="threat"><div class="th_name th_col thr_header">xyz</div><div class="th_descr th_col thr_header">xyz</div></div>
    <div id="tWRDthreats" class="threats">
    </div>
</div>
<div id="checklist_tEQT" class="checklist">
    <div class="threat"><div class="th_name th_col thr_header">xyz</div><div class="th_descr th_col thr_header">xyz</div></div>
    <div id="tEQTthreats" class="threats">
    </div>
</div>

<div id="exp_div" style="display: none">
<form id="exp_form" action="share.php" method="post" enctype="multipart/form-data">
<input id="exp_action" type="hidden" name="op" value="reflect">
<input id="exp_name" type="text" name="name">
<textarea id="exp_contents" name="contents"></textarea>
</form>
</div>

</body>
</html>
