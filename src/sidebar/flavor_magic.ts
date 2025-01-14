import { getPubspecAsMap, openYamlEditor } from "../utils/src/language_utils/dart/pubspec/pubspec_utils";
import { ScriptsType, SideBarEntryItem, TreeScriptModel } from "../utils/src/vscode_feature/sidebar/sidebar_model";
import { BaseTreeDataProvider } from "../utils/src/vscode_feature/sidebar/sidebar_tree_provider";
import * as vscode from 'vscode';
import { openBrowser, showPicker, sleep, tryRun } from "../utils/src/vscode_utils/vscode_utils";
import { runCommand, runTerminal } from "../utils/src/terminal_utils/terminal_utils";
import { findApplicationId, gradleAddFlavor } from "../utils/src/android/app_build_gradle";
import { Icon_Info, Icon_Project, logError, logInfo, showInfo } from "../utils/src/logger/logger";
import { toLowerCamelCase } from "../utils/src/regex/regex_utils";
import { createFile, getYAMLFileContent, isFileExist, listFilesInDirectory, openEditor } from "../utils/src/vscode_utils/editor_utils";
import { getRootPath, getWorkspacePath } from "../utils/src/vscode_utils/vscode_env_utils";
import path = require("path");
import { reFormat } from "../utils/src/vscode_utils/activate_editor_utils";
import { spawn } from "child_process";
import { get } from "lodash";
import * as changeCase from "change-case";

const projectSetupScripts: TreeScriptModel[] = [
    {
        scriptsType: ScriptsType.customer,
        label: 'Step 1. Setup flavor',
        script: 'Setup flavor',
        description: 'Use flavorizr to setup flavor',
    },
    {
        scriptsType: ScriptsType.terminal,
        label: 'Step 2. Run Flavorizr',
        script: 'flutter pub run flutter_flavorizr',
        description: 'flutter pub run flutter_flavorizr',
    },
    {
        scriptsType: ScriptsType.customer,
        label: 'Step 3. Create firebase project by flavor',
        script: 'Create firebase by flavor',
        description: 'Select flavor to create firebase project',
    },
    {
        scriptsType: ScriptsType.customer,
        label: 'Step 4. Pull and setup firebase json by flavor',
        script: 'Setup firebase to project',
        description: 'Pull firebase project option and deploy to flavor',
    },
    {
        scriptsType: ScriptsType.customer,
        label: 'Step 5. Create Application.dart',
        script: 'Create Application dart file',
        description: 'Create Application.dart template',

    },

]

class Project {
    projectDisplayName: string;
    projectID: string;
    projectNumber: string;

    constructor() {
        this.projectDisplayName = ''
        this.projectID = ''
        this.projectNumber = ''
    }
}

class FirebaseFlavor {
    flavorName: string;
    applicationId: string;
    displayName: string;
    constructor() {
        this.flavorName = ''
        this.applicationId = ''
        this.displayName = ''
    }

    firebaseProjectId(): string {
        return convertApplicationIdToProjectId(this.applicationId)
    }
    bundleId(): string {
        return this.firebaseProjectId().replace(/-/g, '.')
    }

}


type NewType = vscode.ProviderResult<SideBarEntryItem[]>;

export class FlavorMagicDataProvider extends BaseTreeDataProvider {
    supportScripts(): TreeScriptModel[] {
        return [...projectSetupScripts];

    }
    viewsId(): string {
        return "FlavorMagicDataProvider"
    }

    getChildren(
        element?: SideBarEntryItem
    ): vscode.ProviderResult<SideBarEntryItem[]> {
        return Promise.resolve(this.createData(),);
    }

    private async createData(): Promise<SideBarEntryItem[]> {
        let yaml = await getPubspecAsMap()
        let flavorIsSetup = this.findFlutterFlavorizr(yaml)
        this.showFlavorizrEditor(flavorIsSetup, yaml)
        let script = FlavorMagicDataProvider.parseScripts(projectSetupScripts);
        if (flavorIsSetup) {
            script = script.filter((script) => { return script.label != "Setup flavor" })
        }
        return script
    }

    async showFlavorizrEditor(flavorIsSetup: boolean, yaml: any) {
        if (flavorIsSetup) {
            let flavors = await this.findFlavors()
            let currentFlavors = flavors.map((flavor) => { return flavor.flavorName }).join(',')
            vscode.window.showInformationMessage(`Flutter already setup with ${currentFlavors}`, 'Read More').then(async (value) => {
                if (value == 'Read More') {
                    openBrowser('https://pub.dev/packages/flutter_flavorizr')
                }
            })
            return
        }

        vscode.window.showInformationMessage('Setting dependencies on flavorizr', 'Add Flavorizr', 'Read More').then(async (value) => {
            if (value == 'Read More') {
                openBrowser('https://pub.dev/packages/flutter_flavorizr')
            } else if (value == 'Add Flavorizr') {
                if (yaml['dependencies']['firebase_core'] == undefined) {
                    runTerminal('flutter pub add firebase_core')
                }
                if (!this.findFlutterFlavorizr(yaml)) {
                    runTerminal('flutter pub add flutter_flavorizr --dev')
                }
                if (yaml['dependencies']['package_info_plus'] == undefined) {
                    runTerminal('flutter pub add package_info_plus')
                }
                // wait 1 second to make sure flutter pub add flutter_flavorizr is done
                await sleep(1000)
                let applicationId = findApplicationId()
                let projectName = yaml!['name']
                applicationId = convertApplicationId(applicationId)
                let finalApplicationId = await vscode.window.showInputBox({ prompt: `${Icon_Info} Set up bundleId / applicationId`, value: applicationId }).then((value) => {
                    return value
                })
                if (finalApplicationId == undefined) return
                let appName = await vscode.window.showInputBox({ prompt: `${Icon_Info} Set up App name`, value: projectName }).then((value) => {
                    return value
                })
                if (finalApplicationId == undefined || appName == undefined) return
                let flavor = await vscode.window.showInputBox({ prompt: `${Icon_Info} set Flavor => prod,dev,staging`, value: "prod,dev" }).then((value) => {
                    return value?.split(',')
                })
                if (finalApplicationId == undefined || appName == undefined || flavor == undefined) return
                finalApplicationId = convertApplicationId(finalApplicationId)

                let template = this.createFlavorizrTemplate(finalApplicationId, appName, flavor)
                let absPath = path.join(await getRootPath(), 'flavorizr.yaml')
                await createFile(absPath, template)
                let edit = await openEditor(absPath)
                // let lastLine = pubspecEditor!.document.lineAt(pubspecEditor!.document.lineCount - 1)
                // // insert template to pubspec.yaml latest line
                // pubspecEditor!.edit((editBuilder) => {
                //     editBuilder.insert(lastLine.range.end, template)
                // }
                // )

                // save editor
                await vscode.window.showInformationMessage("Will create numerous file,make sure your git commit status", "Create", "Cancel").then((value) => {
                    if (value == "Create") {
                        runTerminal("flutter pub run flutter_flavorizr")
                    }
                })


            }
        })
    }

    findFlutterFlavorizr(yaml: any): boolean {
        if (yaml['dev_dependencies'] == undefined) return false
        return yaml['dev_dependencies']['flutter_flavorizr'] != undefined && yaml['flavorizr'] != undefined
    }

    createFlavorizrTemplate(applicationId: string, appName: string, flavor: string[]) {
        let template = `
flavors:      
    `
        for (let f of flavor) {
            template += this.createFlavorTemplate(applicationId, appName, f)
        }
        logInfo(template)
        return template
    }

    createFlavorTemplate(applicationId: string, appName: string, flavor: string) {
        let template = `
    ${flavor}:
      app:
        name: "${appName} ${flavor}"

      android:
        applicationId: "${applicationId}.${flavor}"
        #firebase:
        #  config: ".firebase/${flavor}/google-services.json"

      ios:
        bundleId: "${applicationId}.${flavor}"
        firebase:
          config: ".firebase/${flavor}/GoogleService-Info.plist"
        buildSettings:
        # Development Team is visible in the apple developer portal 
        # DEVELOPMENT_TEAM: YOURDEVTEAMID 
        # PROVISIONING_PROFILE_SPECIFIER: "Dev-ProvisioningProfile"
        `
        return template
    }

    async handleCommand(context: vscode.ExtensionContext, script: TreeScriptModel): Promise<void> {
        let allScripts = this.supportScripts().map((item) => { return item.script })
        let cmd: string = script.script
        if (allScripts.includes(cmd)) {
            if (script.scriptsType == ScriptsType.customer) {
                if (script.script == 'Add Flavor') {
                    await this.addFlavor()
                }
                if (script.script == 'Setup flavor') {
                    let yaml = await getPubspecAsMap()
                    await this.showFlavorizrEditor(this.findFlutterFlavorizr(yaml), yaml)
                }
                if (script.script == 'Create firebase by flavor') {
                    this.createFirebaseByFlavor(context)
                }
                if (script.script == 'Setup firebase to project') {
                    this.setupFireBaseOption(context)
                }
                if (script.script == 'Create Application dart file') {
                    this.createApplicationTemplate()
                }


            }
            else {
                super.handleCommand(context, script)
            }
        }
    }

    async addFlavor() {
        let flavor = await vscode.window.showInputBox({ prompt: "Add Flavor" }).then((value) => {
            if (value) {
                return value
            }
        })
        if (flavor == undefined) return
        gradleAddFlavor(toLowerCamelCase(flavor))
    }

    async createFirebaseByFlavor(context: vscode.ExtensionContext) {

        let firebaseFlavor: FirebaseFlavor[] = await this.findFlavors()
        // let currentProject = await this.fetchFirebaseFlavor()
        // // filter exist project from current project
        // if (firebaseFlavor.length == 0) {
        //     logError("Can't find any flavor in Yaml, Use flavorizr to add flavor first")
        //     return
        // }
        let createAbleProject = []
        //  createAbleProject = firebaseFlavor.filter((item) => {
        //     return currentProject.filter((f) => {
        //         let flavorToProjectId = convertApplicationIdToProjectId(item.applicationId)
        //         return flavorToProjectId != f.projectID
        //     })
        // }
        // )
        createAbleProject =firebaseFlavor
        let createAbleFlavorItem: { label: string; description: string; firebaseFlavor: FirebaseFlavor }[] = []

        for (let f of createAbleProject) {
            let flavorToProjectId = convertApplicationIdToProjectId(f.applicationId)
            createAbleFlavorItem.push({ label: f.flavorName, description: f.displayName, firebaseFlavor: f })
        }
        showPicker("Select flavor to create firebase project ", createAbleFlavorItem, async (item) => {

            let flutter_yaml = await getPubspecAsMap()
            if (!flutter_yaml || typeof flutter_yaml !== 'object') {
                throw new Error('Invalid yaml object');
            }
            let name: string = flutter_yaml['name'];
            let defaultName = convertApplicationIdToProjectId(`${name}-${item.firebaseFlavor.flavorName}`)
            vscode.window.showInformationMessage(`Will create firebase project ${defaultName} `, "Create", "Modify").then((value) => {
                if (value == "Create") {
                    let cmd = `firebase projects:create --display-name= ${defaultName} `
                    runTerminal(cmd)
                }
                if (value == "Modify") {
                    vscode.window.showInputBox({ prompt: "Modify firebase project name", value: `${defaultName}` }).then((value) => {
                        if (value) {
                            value = convertApplicationIdToProjectId(value)
                            let cmd = `firebase projects:create --display-name= ${value}`
                            runTerminal(cmd)
                        }
                    })
                }
            })

        }
        )
    }



    async fetchFirebaseFlavor(): Promise<Project[]> {
        let text = await this.syncFireBase()
        let rows = text.match(/\│\s*(.*?)\s*\│\s*(.*?)\s*\│\s*(.*?)\s*\│\s*(.*?)\s*\│/g)!
        let projects: Project[] = []
        for (let r of rows) {
            let items = r.match(/\│\s*(.*?)\s*\│\s*(.*?)\s*\│\s*(.*?)\s*\│/g)![0].split('│').filter((i) => i != '').map((i) => i.trim())
            if (items[0].includes('Display Name')) continue
            let project: Project = new Project()
            project.projectDisplayName = items[0]
            project.projectID = items[1]
            project.projectNumber = items[2]
            projects.push(project)
        }
        return projects

    }

    async findFlavors(): Promise<FirebaseFlavor[]> {
        let p = getWorkspacePath("flavorizr.yaml")
        let yaml = await getYAMLFileContent(p)
        if (yaml == undefined) return []
        let flavors = yaml['flavors']
        let firebaseFlavors: FirebaseFlavor[] = []
        // map flavors to firebaseFlavors
        for (let flavor in flavors) {
            let firebaseFlavor = new FirebaseFlavor()
            firebaseFlavor.flavorName = flavor
            firebaseFlavor.applicationId = flavors[flavor]['android']['applicationId']
            firebaseFlavor.displayName = flavors[flavor]['app']['name']
            firebaseFlavors.push(firebaseFlavor)
        }
        return firebaseFlavors

    }

    async syncFireBase(): Promise<string> {
        showInfo("Sync firebase project")
        return await runCommand('firebase projects:list', undefined)
    }


    async setupFireBaseOption(context: vscode.ExtensionContext) {

        runTerminal('firebase projects:list')
        // let text = await this.syncFireBase()
        // let rows = text.match(/\│\s*(.*?)\s*\│\s*(.*?)\s*\│\s*(.*?)\s*\│\s*(.*?)\s*\│/g)!
        let projects: Project[] = []
        // for (let r of rows) {
        //     let items = r.match(/\│\s*(.*?)\s*\│\s*(.*?)\s*\│\s*(.*?)\s*\│/g)![0].split('│').filter((i) => i != '').map((i) => i.trim())
        //     if (items[0].includes('Display Name')) continue
        //     let project: Project = new Project()
        //     project.projectDisplayName = items[0]
        //     project.projectID = items[1]
        //     project.projectNumber = items[2]
        //     projects.push(project)
        // }
        let projectsItems: { label: string; id: string; }[] = []
        await vscode.window.showInformationMessage("Copy \"$DisplayName,$ProjectID,$ProjectNumber\"", "Create", "Cancel").then(async (value) => {
            if (value == "Create") {

                let displayName =""
                let projectID = ""
                let projectNumber = ""

                let result = await vscode.window.showInputBox({ prompt: `${Icon_Info} Paste "$DisplayName,$ProjectID,$ProjectNumber"`, }).then((value) => {
                    value = value?.replace("│",",").replace("│",",")
                    let r = value?.split(",")
                    if (r != undefined && r.length == 3) {
                        displayName = r[0].trim()
                        projectID = r[1].trim()
                        projectNumber = r[2].trim()
                        projects.push({ projectDisplayName: displayName, projectID: projectID, projectNumber: projectNumber })

                        projectsItems.push({ label: `${r[0]}`, id: r[1] })
                        return projectsItems
                    }else{
                        return undefined
                    }
                    
                })
                if (result == undefined) return

                projectsItems = projects.map((p) => { return { label: `${Icon_Project} ${p.projectDisplayName}`, id: p.projectID } })
                let yaml = await getPubspecAsMap()
                let packageName = yaml!['name']
                let firebaseFlavors: FirebaseFlavor[] = await this.findFlavors()

                let createAbleFlavorItem: { label: string; description: string; firebaseFlavor: FirebaseFlavor }[] = []

                for (let f of firebaseFlavors) {
                    createAbleFlavorItem.push({ label: f.flavorName, description: `appName: ${f.displayName} , id : ${f.applicationId} `, firebaseFlavor: f })
                }

                showPicker(`${Icon_Info} Select flavor and set  to firebase project [${displayName}]`, createAbleFlavorItem, async (item) => {
                    if (item == undefined)
                        return;
                    let selectFlavorApplicationId: string = item['firebaseFlavor']['applicationId'];
                    if (selectFlavorApplicationId.startsWith('com')) {
                        selectFlavorApplicationId.replace('com.', '');
                    }
                    let fileName = convertApplicationIdToFileName(selectFlavorApplicationId);
                    let flavor = item.label;
                    showPicker(`${Icon_Info} Setting firebase to  Flavor ${flavor}  `, projectsItems, async (firebaseSelected) => {
                        if (firebaseSelected) {
                            let folder = 'lib/firebase_options';
                            runCommand(`mkdir -p ${folder}`);

                            let cmd = `flutterfire config \
            --project=${firebaseSelected.id} \
            --out=${folder}/${flavor}_firebase_options.dart \
            --ios-bundle-id=${selectFlavorApplicationId} \
            --android-app-id=${selectFlavorApplicationId} `;
                            showInfo(`${Icon_Info} Platform in terminal `)
                            try {
                                if (isFileExist('ios/Runner/GoogleService-Info.plist')) {
                                    runCommand(`rm ios/Runner/GoogleService-Info.plist`);
                                }
                                runTerminal(cmd);
                                tryMoveIosFile(context, flavor);
                                tryMoveAndroidFile(flavor);
                                if (yaml!['dependencies']['firebase_core'] == undefined) {
                                    runTerminal('flutter pub add firebase_core')
                                }

                            }
                            catch (e) {
                                console.log(e);
                            }

                        }
                    });
                })
            }
        })


    }



    createEnumTemplate(firebaseFlavors: FirebaseFlavor[]) {
        let fl = firebaseFlavors.map((f) => toLowerCamelCase(f.flavorName)).join(',')
        return `enum Flavor { ${fl} }\n\n`
    }

    async getFireBaseOptions(): Promise<String[]> {
        let files = await listFilesInDirectory(vscode.Uri.parse(getWorkspacePath('/lib/firebase_options')!))
        return files
    }

    async createFireBaseOptionsSwitchTemplate(): Promise<String> {
        let files = await this.getFireBaseOptions()
        let flavors = files.map((f) => f.split('_').slice(-3)[0])
        let template = `static FirebaseOptions get firebaseOptions {
switch (flavor) {
    ${flavors.map((f) => `case Flavor.${toLowerCamelCase(f)}: \nreturn ${f}.DefaultFirebaseOptions.currentPlatform;`).join('\n')}
    default:
        throw UnsupportedError('FirebaseOptions for $flavor is not supported');
  }
}       
        `
        return template
    }

    async createImportTemplate(packageName: string) {
        let files = await this.getFireBaseOptions()
        let imports = files.map((f) => `import 'package:${packageName}/firebase_options/${f}' as ${f.split('_').slice(-3)[0]};`).join('\n')
        return imports

    }





    async createApplicationTemplate() {
        let isExist = isFileExist('lib/application/application.dart')
        if (isExist) {
            logInfo('lib/application/Application.dart is exist')
            return
        }
        runTerminal('mkdir -p lib/application')
        let absPath = path.join(await getRootPath(), 'lib/application/application.dart')
        let yaml = await getPubspecAsMap()
        let firebaseFlavors: FirebaseFlavor[] = await this.findFlavors()
        let flavors: string[] = firebaseFlavors.map((f) => f.flavorName)
        let template =
            `
    
    //  Auto generated file. By LazyJack vscode extension

    import 'package:firebase_core/firebase_core.dart';
    import 'package:flutter/material.dart';
    import 'package:package_info_plus/package_info_plus.dart';
    ${await this.createImportTemplate(yaml!['name'])}

    ${this.createEnumTemplate(firebaseFlavors)}       
    
    /// void main() async{ 
    ///  await Application.init(name: 'application_name', flavor: flavor);
    ///  runApp(app);
    ///
    class Application {
        static Flavor flavor = Flavor.${firebaseFlavors[0].flavorName};
        static late FirebaseApp firebaseApp;
        static bool isDev = true;

        static Future<void> init(
            {required String name}) async {
            WidgetsFlutterBinding.ensureInitialized();
            PackageInfo packageInfo = await PackageInfo.fromPlatform();
            ${generateFlavorSwitch(flavors)}

            firebaseApp =
                await Firebase.initializeApp(name: name, options: firebaseOptions);
        }


      ${await this.createFireBaseOptionsSwitchTemplate()}
    
    }
    

    
    
        `
        try {
            runCommand(`mkdir -p ${getWorkspacePath('lib/application')}`)
            await createFile(absPath, template)
        } catch (e) {
            console.log(e)
        }
        let edit = await openEditor(absPath)
        if (edit == undefined) {
            logError("try again")
        }
        else {
            reFormat()

        }
    }



}


async function tryMoveIosFile(context: vscode.ExtensionContext, flavor: string) {
    let result = await tryRun(
        () => {
            return isFileExist('ios/Runner/GoogleService-Info.plist')
        }
    )
    if (result != undefined) {
        runCommand(`mkdir -p ios/config/${flavor}`)
        runCommand(`mv ios/Runner/GoogleService-Info.plist ios/config/${flavor}/GoogleService-Info.plist`)
        runRubyScript(context)

    }
}


async function tryMoveAndroidFile(flavor: string) {
    let result = await tryRun(
        () => {
            return isFileExist('android/app/google-services.json')
        }
    )
    if (result != undefined) {
        runCommand(`mkdir -p android/app/src/${flavor}`)
        runCommand(`mv android/app/google-services.json android/app/src/${flavor}/google-services.json`)
    }
}


function convertApplicationIdToFileName(string: string) {
    return string.replace(/[.-]/g, "_")
}

function convertApplicationId(string: string) {
    return string.replace(/[_-]/g, ".");
}


function convertApplicationIdToProjectId(string: string) {
    return string.replace(/[._]/g, "-");
}



function runRubyScript(context: vscode.ExtensionContext) {
    const rubyScriptPath = path.join(context.extensionPath, 'src/ruby/plist_to_flavor.rb'); // Ruby 腳本的路徑
    // walk  extensionPath dir
    const cwd = path.join(getRootPath(), 'ios'); // Ruby 腳本的路徑

    const childProcess = spawn('ruby', [rubyScriptPath], { cwd });

    childProcess.stdout.on('data', (data: string) => {
        logInfo(data.toString()); // 輸出 Ruby 腳本的標準輸出
    });

    childProcess.stderr.on('data', (data: string) => {
        logError(data.toString()); // 輸出 Ruby 腳本的錯誤輸出
    });
}


function generateFlavorSwitch(firebaseFlavors: string[]): string {
    let cases = firebaseFlavors.map(flavor => {
        return `
        case String name when name.endsWith('.${flavor}'):
          Application.isDev = ${flavor === 'dev'};
          flavor = Flavor.${flavor};
          break;`;
    }).join('\n        '); // 生成對應的 case 條件

    let defaultCase = `
        default:
          // Handle other cases or set a default flavor
          Application.isDev = false;
          break;`;

    return `
    switch (packageInfo.packageName) {
        ${cases}
        ${defaultCase}
    }`;
}
