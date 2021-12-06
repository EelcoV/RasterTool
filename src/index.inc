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
<link rel="preload" href="../img/qm-hi.png" as="image">
<link rel="preload" href="../img/find-hi.png" as="image">
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

<body>
<div id="splash" class="fullscreen">
 <p style="font-size: 28pt;">Raster</p>
 <p>Risk Assessment of Telecommunication Services</p>
 <p><small><span id="splashstatus">please wait . . .</span></small></p>
</div>
<div id="goodbye" class="fullscreen" style="display: none;">
 <p style="font-size: 28pt;">Raster</p>
 <p>&nbsp;</p>
 <p><small>goodbye</small></p>
</div>

<div id="toolbar" class="donotprint">
	<!-- Common toolbar items -->
	<div id="libraryactivator" class="toolbarlargebutton">Library..</div>
	<div id="networkactivity"></div>
	<div class="toolbarspacer"></div>
	<div id="undobutton" class="toolbariconbutton"></div>
	<div id="redobutton" class="toolbariconbutton"></div>
	<div class="toolbarspacer"></div>
	<div id="findbutton" class="toolbariconbutton"></div>
	<div id="helpbutton" class="toolbariconbutton"></div>
	<!-- Diagrams tab -->
	<div id="diaopts" class="toolbarsection">
		<div id="templates"> <!-- Is filled in Project.load() --></div>

		<div class="toolbarspacer"></div>
		<div id="vulnlevelsection" class="toolbarlabel">
			<div>Levels:</div>
			<div>
				<fieldset>
					<input type="radio" id="em_none"  name="emblem_size" value="em_none"><label for="em_none" >None</label>
					<input type="radio" id="em_small" name="emblem_size" value="em_small"><label for="em_small">Small</label>
					<input type="radio" id="em_large" name="emblem_size" value="em_large"><label for="em_large">Large</label>
				</fieldset>
			</div>
		</div>

		<div class="toolbarspacer"></div>
		<div id="labelsection" class="toolbarlabel">
			<div>Labels:</div>
			<div>
				<fieldset>
					<input type="radio" id="label_off" name="labelonoff"><label for="label_off">Hide color</label>
					<input type="radio" id="label_on"  name="labelonoff"><label for="label_on" >Show color</label>
				</fieldset>
			</div>
		</div>

		<div class="toolbarspacer"></div>
		<div id="mapsection" class="toolbarlabel">
			<div>Minimap:</div>
			<div>
				<fieldset>
					<input type="radio" id="showmap_off" name="showmap" value="off"><label for="showmap_off">XX</label>
					<input type="radio" id="showmap_on"  name="showmap" value="on" ><label for="showmap_on" >XX</label>
				</fieldset>
			</div>
		</div>
	</div>
	<!-- Single failures tab -->
	<div id="sfopts" class="toolbarsection">
		<div id="sffoldsection" class="toolbarlabel">
			<div>Fold:</div>
			<div>
				<div id="sfcollapseall" class="toolbarbutton">Collapse all</div>
				<div id="sfexpandall" class="toolbarbutton">Expand all</div>
			</div>
		</div>

		<div class="toolbarspacer"></div>
		<div id="sfsortsection" class="toolbarlabel">
			<div>Sort:</div>
			<div>
				<fieldset>
					<input type="radio" id="sfsort_alph" name="sfsort" value="alph"><label for="sfsort_alph">alpha</label>
					<input type="radio" id="sfsort_type" name="sfsort" value="type"><label for="sfsort_type">type</label>
					<input type="radio" id="sfsort_thrt" name="sfsort" value="thrt"><label for="sfsort_thrt">vuln level</label>
				</fieldset>
			</div>
		</div>
	 </div>
	<!-- Common cause failures tab -->
	<div id="ccfopts" class="toolbarsection">
		<div id="ccffoldsection" class="toolbarlabel">
			<div>Fold:</div>
			<div>
				<div id="ccfcollapseall" class="toolbarbutton">Collapse all</div>
				<div id="ccfexpandall" class="toolbarbutton">Expand all</div>
			</div>
		</div>

		<div class="toolbarspacer"></div>
		<div id="ccfsortsection" class="toolbarlabel">
			<div>Sort:</div>
			<div>
				<fieldset>
					<input type="radio" id="ccfsort_alph" name="ccfsort" value="alph"><label for="ccfsort_alph">alpha</label>
					<input type="radio" id="ccfsort_type" name="ccfsort" value="type"><label for="ccfsort_type">type</label>
					<input type="radio" id="ccfsort_thrt" name="ccfsort" value="thrt"><label for="ccfsort_thrt">vuln level</label>
				</fieldset>
			</div>
		</div>
	</div>
	<!-- Analysis tab - Failures and Vulnerabilities -->
	<div id="anavulnopts" class="toolbarsection">
		<div id="anavnsortsection" class="toolbarlabel">
			<div>Sort nodes and clusters:</div>
			<div>
				<fieldset>
					<input type="radio" id="ana_nodesort_alph" name="ana_nodesort"><label for="ana_nodesort_alph">alpha</label>
					<input type="radio" id="ana_nodesort_type" name="ana_nodesort"><label for="ana_nodesort_type">type</label>
					<input type="radio" id="ana_nodesort_thrt" name="ana_nodesort"><label for="ana_nodesort_thrt">vuln level</label>
				</fieldset>
			</div>
		</div>
		<div class="toolbarspacer"></div>
		<div id="anavfsortsection" class="toolbarlabel">
			<div>Sort:</div>
			<div>
				<fieldset>
					<input type="radio" id="ana_failsort_alph" name="ana_failsort"><label for="ana_failsort_alph">alpha</label>
					<input type="radio" id="ana_failsort_type" name="ana_failsort"><label for="ana_failsort_type">type</label>
				</fieldset>
			</div>
		</div>
		<div class="toolbarspacer"></div>
		<div id="anavexcludesection" class="toolbarlabel">
			<div>SClick cells to include/exclude them.</div>
			<div>
				<div id="quickwinslink" class="toolbarbutton">Quick wins</div>
				<div id="clearexclusions" class="toolbarbutton">Clear exclusions</div>
			</div>
		</div>
	</div>
	<!-- Analysis tab - Longlist -->
	<div id="anallopts" class="toolbarsection">
		<div id="anallincsection" class="toolbarlabel">
			<div>Include:</div>
			<div>
				<input type="checkbox" id="incX" checked><label for="incX">Unknown</label><br>
				<input type="checkbox" id="incA" checked><label for="incA">Ambiguous</label>
			</div>
		</div>
		<div class="toolbarspacer"></div>
		<div id="anallminsection" class="toolbarlabel">
			<div>Minimum value:</div>
			<div>
				<select id="minV"></select>
			</div>
		</div>
	</div>
</div> <!-- toolbar -->
<div id="classroom" class="ui-widget"></div>
<div id="currentProject" class="ui-widget projectname"></div>

#ifdef SERVER
<div id="librarypanel" class="actpanel">
  <form id="libform">
    <table>
    <tr><td>
        <input id="libactivate" type="button" value="Activate">
        <input id="libprops" type="button" value="Details">
        <input id="libexport" type="button" value="Export">
        <input id="libdel" type="button" value="Delete">
        <input id="libmerge" type="button" value="Merge">
    </td></tr>
    <tr><td>
        <select id="libselect" size="8"></select>
    </td></tr>
    <tr><td style="padding-bottom:1px">
        <input id="libadd" type="button" value="New">
        <input id="libimport" type="button" value="Import">
        <input id="libexportall" type="button" value="Export library">
        <input id="fileElem" type="file">
        <input id="libcheck" type="button" value="?">
        <input id="libzap" type="button" value="Zap library">
    </td>
    </tr>
	<tr><td>
		<div id="onlineonoff">
			<span class="leftlabel ui-widget ui-state-default">Network connection:</span>
			<fieldset>
				<input type="radio" id="online_off" name="onlineonoff"><label for="online_off">Offline</label>
				<input type="radio" id="online_on" name="onlineonoff" checked="checked"><label for="online_on">Online</label>
			</fieldset>
		</div>
	</td></tr>
	<tr><td>
		<div id="creator_name">
			<span class="leftlabel ui-widget ui-state-default">Your name:</span>
			<input type="text" id="creator">
		</div>
	</td></tr>
    </table>
  </form>
</div>
#endif

#ifdef STANDALONE
<div id="pdfoptions">
    <div id="pdf_orientation" class="controlgroup">
        <span class="pdflabel ui-widget ui-state-default">Orientation:</span>
        <fieldset>
            <input type="radio" name="pdf_orientation" id="paperorientation_portrait"><label id="label_portrait" for="paperorientation_portrait">XXX</label>
            <input type="radio" name="pdf_orientation" id="paperorientation_landscape"><label id="label_landscape" for="paperorientation_landscape">YYY</label>
        </fieldset>
    </div>
    <div id="pdf_papersize" class="controlgroup">
        <span class="pdflabel ui-widget ui-state-default">Paper size:</span>
        <fieldset>
            <input type="radio" name="pdf_papersize" id="papersize_a4"><label for="papersize_a4">A4</label>
            <input type="radio" name="pdf_papersize" id="papersize_a3"><label for="papersize_a3">A3</label>
        </fieldset>
    </div>
    <div id="pdf_scale" class="controlgroup">
        <span class="pdflabel ui-widget ui-state-default">Scale:</span>
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
            <li><a href="../help/Frequency.html">Frequency</a></li>
            <li><a href="../help/Impact.html">Impact</a></li>
            <li><a href="../help/Process.html">How to use</a></li>
            <li><a href="../help/About.html">About</a></li>
        </ul>
    </div>
</div>

<ul id="nodemenu">
    <li class="lcT"><div><span>Node</span></div></li>
    <li id="mi_th"><div><span>Vulnerabilities</span></div></li>
    <li id="mi_ct"><div><span>Change type</span></div>
     <ul id="mi_ctsm">
      <li id="mi_cttWLS"><div><span>Wireless link</span></div></li>
      <li id="mi_cttWRD"><div><span>Wired link</span></div></li>
      <li id="mi_cttEQT"><div><span>Equipment</span></div></li>
      <li id="mi_cttACT"><div><span>Actor</span></div></li>
      <li id="mi_cttUNK"><div><span>Unknown link</span></div></li>
     </ul>
	</li>
    <li id="mi_cl"><div><span>Class</span></div>
     <ul id="mi_clsm">
      <li id="mi_rc"><div><span>Rename class</span></div></li>
      <li id="mi_sx"><div><span>Rename suffix</span></div></li>
      <li id="mi_sm"><div><span>Similar/Identical</span></div></li>
     </ul>
	</li>
    <li id="mi_du"><div><span>Duplicate</span></div></li>
    <li id="mi_cc"><div><span>Label</span></div>
     <ul id="mi_ccsm">
      <li id="mi_ccnone"><div><div class="noneblock Bnone"><img src="../img/nolabel.png"></div><span>No label</span></div></li>
      <li id="mi_ccred"><div><div class="smallblock Bred"></div><span>Red</span></div></li>
      <li id="mi_ccorange"><div><div class="smallblock Borange"></div><span>Orange</span></div></li>
      <li id="mi_ccyellow"><div><div class="smallblock Byellow"></div><span>Yellow</span></div></li>
      <li id="mi_ccgreen"><div><div class="smallblock Bgreen"></div><span>Green</span></div></li>
      <li id="mi_ccblue"><div><div class="smallblock Bblue"></div><span>Blue</span></div></li>
      <li id="mi_ccpink"><div><div class="smallblock Bpink"></div><span>Pink</span></div></li>
      <li id="mi_ccpurple"><div><div class="smallblock Bpurple"></div><span>Purple</span></div></li>
      <li id="mi_ccgrey"><div><div class="smallblock Bgrey"></div><span>Grey</span></div></li>
      <li id="mi_ccedit"><div><span>Edit labels ...</span></div></li>
     </ul>
	</li>
    <li id="mi_de"><div><span>Delete</span><span class="ui-icon ui-icon-trash"></div></li>
</ul>
<ul id="selectmenu">
    <li class="lcT"><div><span>Selection</span></div></li>
	<li id="mi_sc"><div><span>Label</span></div>
		<ul id="mi_scsm">
			<li id="mi_scnone"><div><div class="noneblock Bnone"><img src="../img/nolabel.png"></div><span>No label</span></div></li>
			<li id="mi_scred"><div><div class="smallblock Bred"></div><span>Red</span></div></li>
			<li id="mi_scorange"><div><div class="smallblock Borange"></div><span>Orange</span></div></li>
			<li id="mi_scyellow"><div><div class="smallblock Byellow"></div><span>Yellow</span></div></li>
			<li id="mi_scgreen"><div><div class="smallblock Bgreen"></div><span>Green</span></div></li>
			<li id="mi_scblue"><div><div class="smallblock Bblue"></div><span>Blue</span></div></li>
			<li id="mi_scpink"><div><div class="smallblock Bpink"></div><span>Pink</span></div></li>
			<li id="mi_scpurple"><div><div class="smallblock Bpurple"></div><span>Purple</span></div></li>
			<li id="mi_scgrey"><div><div class="smallblock Bgrey"></div><span>Grey</span></div></li>
			<li id="mi_scedit"><div><span>Edit labels ...</span></div></li>
		</ul>
	</li>
	<li id="mi_sd"><div><span>Delete selection</span><span class="ui-icon ui-icon-trash"></div></li>
</ul>
<ul id="ccfmenu">
    <li class="lcT"><div><span>Common failures</span></div></li>
	<li id="mi_ccfc"><div><span>Create new cluster</span></div></li>
	<li id="mi_ccfm"><div><span>Move to</span></div>
	 <ul id="mi_ccfmsm">
	 </ul>
	</li>
</ul>
<div id="nodereport" class="nodereport"></div>
<div id="componentthreats" class="componentthreats"></div>

<div id="checklist_tWLS" class="checklist">
    <div class="threat"><div class="th_name th_col thr_header">Name</div><div class="th_descr th_col thr_header">Description</div></div>
    <div id="tWLSthreats" class="threats">
    </div>
</div>
<div id="checklist_tWRD" class="checklist">
    <div class="threat"><div class="th_name th_col thr_header">Name</div><div class="th_descr th_col thr_header">Description</div></div>
    <div id="tWRDthreats" class="threats">
    </div>
</div>
<div id="checklist_tEQT" class="checklist">
    <div class="threat"><div class="th_name th_col thr_header">Name</div><div class="th_descr th_col thr_header">Description</div></div>
    <div id="tEQTthreats" class="threats">
    </div>
</div>

<div id="tabs">
    <ul>
        <li><a href="#tab_diagrams">Diagrams</a></li>
        <li><a href="#tab_singlefs">Single failures</a></li>
        <li class="longtab"><a href="#tab_ccfs" class="longlink">Common cause failures</a></li>
        <li><a href="#tab_analysis">Analysis</a></li>
    </ul>
    

<div id="tab_diagrams" class="workbody workouter">
  <div id="diagrams_body" class="tabs-bottom">
    <div id="mask-collection" class="donotprint"><!-- mask images to be inserted here --></div>
    <div id="selectrect"></div>
    <input id="servaddbuttondia" class="servplusbutton" type="button" value=" + ">
    <ul id="bottomtabsdiagrams">
    </ul>
  </div>    
</div>


<div id="tab_singlefs" class="workbody workouter">
  <div id="singlefs_body" class="tabs-bottom">
    <input id="servaddbuttonsf" class="servplusbutton" type="button" value=" + ">
    <ul id="bottomtabssinglefs">
    </ul>
  </div>    
</div>


<div id="tab_ccfs" class="workbody workouter">
  <div id="ccfs_body" class="workbody workinner ui-widget-content"></div>
  <div id="ccfs_details" class="workbody workinner ui-widget-content"></div>
</div>


<div id="tab_analysis" class="workbody workouter">
  <div id="analysis_body" class="tabs-bottom tabs-flushleft">
  <ul id="bottomtabsana">
     <li class="longtab"><a class="longlink" href="#at1">Failures and Vulnerabilities</a></li>
     <li class="longtab"><a class="longlink" href="#at2">Single failures by level</a></li>
     <li class="longtab"><a class="longlink" href="#at3">Node counts</a></li>
     <li class="longtab"><a class="longlink" href="#at4">Checklist reports</a></li>
     <li class="longtab"><a class="longlink" href="#at5">Longlist</a></li>
  </ul>
  <div id="at1" class="workspace plainworkspace"></div>
  <div id="at2" class="workspace plainworkspace"></div>
  <div id="at3" class="workspace plainworkspace"></div>
  <div id="at4" class="workspace plainworkspace"></div>
  <div id="at5" class="workspace plainworkspace"></div>
  </div>
</div>


</div> <!-- id="tabs" -->

<div id="modaldialog"></div>

<div id="exp_div" style="display: none">
<form id="exp_form" action="share.php" method="post" enctype="multipart/form-data">
<input id="exp_action" type="hidden" name="op" value="reflect">
<input id="exp_name" type="text" name="name">
<textarea id="exp_contents" name="contents"></textarea>
</form>
</div>

</body>
</html>
