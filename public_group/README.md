#  Project Groups
A ''group'' is a separate area in which project can be stored on the server.
The group's directory can be protected using the web server's access authorization; a sample ''htaccess'' file is provided as an example.
Although groups are mainly useful for Shared projects, all Private projects belong to a specific group as well.

The default group is called 'public_group' and has no access control; the web server administrator can override this if required.

To create a new project group called 'samplegroup':
1. Duplicate the public_group directory structure as a new directory 'samplegroup'. All files should be readable by the web server; the directory SharedProjects should be writable.
2. Set access permissions, if required.
3. Create a suitable project to be used as the starting point for new projects, if required.
4. Modify the settings file 'group.json', if required.

## group.json
The settings for a group are stored in a JSON configuration file. Currently the file may contain two fields.
* classroom: (boolean, default is false) If true, classroom functionality is enabled on this group. See below.
* template: (string, default is "Project Template") The name of the project that will be used as the starting point when a new project is created. If no shared project by this name exists, an empty project is used instead.
* iconset: (string, default is "default") The name of the iconset for new projects. If both 'template' and 'iconset' are specified, the template has precedence.

## Classroom functionality
For training purposes it may be useful to provide sample projects to the students, that the students should not be able to modify.
This can be achieved by setting the 'classroom' property to 'true'.
When classroom functionality is enabled, opening a shared project will create a new private copy instead.
This way each student can open the project provided by the course teacher, and make their own personal changes.

Students cannot set their private projects to shared, to prevent them from uploading their work for others to see.
