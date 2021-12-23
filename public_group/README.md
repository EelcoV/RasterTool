#  Project Groups
A *group* is a separate area in which projects can be stored on the web server.
The group`s directory can be protected using the web server`s access authorization; a sample `htaccess` file is provided as an example.
Although groups are mainly useful for Shared projects, all Private projects belong to a specific group as well.

The default group is called `public_group` and has no access control; the web server administrator can override this if required.

To create a new project group (called `samplegroup` in these instructions):
1. Duplicate the public_group directory structure as a new directory `samplegroup`. All files should be readable by the web server; the directory `SharedProjects` should be writable.
2. Set access permissions, if required.
3. Create a suitable project to be used as the template (starting point for new projects), if required.
4. Inspect and modify the settings file `group.json` if required.

## group.json
The settings for a group are stored in a JSON configuration file. Currently the file may contain these fields:
* *classroom:* (boolean, default is `false`) If true, classroom functionality is enabled on this group. See below.
* *template:* (string, default is "Project Template") The name of the project that will be used as the starting point when a new project is created, instead of a blank project. Set to "" to disable the template. 
* *iconset:* (string, default is "default") The name of the iconset for new projects. If both `template` and `iconset` are specified, the iconset in the template project has precedence. See the `README.md` in the directory `img/iconset` for details.
* *localonly:* (boolean, default is `false`) If true, projects cannot be retrieved nor stored on the server. The template will still be used, if present.

A template is most useful to define default vulnerabilities and labels, instead of the builtin defaults. If no shared project with the template name exists, an empty project (with builtin defaults) will be used instead.

### Classroom functionality
For training purposes it may be useful to provide sample projects to the students, which the students should not be able to modify.
This can be achieved by setting the `classroom` property to `true`.
When classroom functionality is enabled, opening a shared project will create a new private copy instead.
This way each student can open the projects provided by the course teacher, and make their own personal changes.

Students cannot set their private projects to shared, to prevent them from uploading their work for others to see.
You can think of the `classroom` option as "can retrieve but cannot store".

### The `localonly` option
When `localonly` is set to `true`, the server offers even less functionality. No project can be stored on the server, as is the case when `classroom` is `true`.
But in addition, no projects will be retrieved from the server. The list of projects in the Projects toolbar will only show private projects.
However, the template project will still be retrieved from the server if `localonly` is set.

You can think of the `localonly` option as "cannot retrieve and cannot store".

### Preparing the web server
To put the course materials (with the `classroom` option) and/or template on the web server, first temporarily disable the `classroom` and `localonly` properties by setting them to `false` in the `group.json` file.
Then create your projects, and share them to upload them to the server. Edit as required.
Finally, when all is set, edit `group.json` again to set `classroom` and/or `localonly` options to true.

When either the `classroom` or `localonly` option is true, the SharedProjects directory on the web server can be made read-only. 

---

Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
See LICENSE.md

