require 'xcodeproj'
require 'pp'
require 'fileutils'


project_path = 'Runner.xcodeproj'
target_name = 'Runner'

project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.display_name == target_name }

# 找到 "Link Binary With Libraries" Build Phase
link_binary_phase = target.build_phases.find { |p| p.isa == 'PBXFrameworksBuildPhase' && p.display_name == 'Link Binary With Libraries' }

# 找到 "copy google-service plist to flavor" Build Phase
google_service_phase = target.build_phases.find { |p| p.display_name == 'copy google-service plist to flavor' }

# 如果 "copy google-service plist to flavor" Build Phase 不存在，則創建一個新的 Build Phase
if google_service_phase.nil?
  shell_script_phase = target.new_shell_script_build_phase('copy google-service plist to flavor')
  pp "add google-service plist to flavor"
  shell_script_phase.shell_script = <<~SCRIPT
    environment="default"

    # Regex to extract the scheme name from the Build Configuration
    # We have named our Build Configurations as Debug-dev, Debug-prod etc.
    # Here, dev and prod are the scheme names. This kind of naming is required by Flutter for flavors to work.
    # We are using the $CONFIGURATION variable available in the XCode build environment to extract 
    # the environment (or flavor)
    # For eg.
    # If CONFIGURATION="Debug-prod", then environment will get set to "prod".
    if [[ $CONFIGURATION =~ -([^-]*)$ ]]; then
      environment=${BASH_REMATCH[1]}
    fi

    echo $environment

    # Name and path of the resource we're copying
    GOOGLESERVICE_INFO_PLIST=GoogleService-Info.plist
    GOOGLESERVICE_INFO_FILE=${PROJECT_DIR}/config/${environment}/${GOOGLESERVICE_INFO_PLIST}

    # Make sure GoogleService-Info.plist exists
    echo "Looking for ${GOOGLESERVICE_INFO_PLIST} in ${GOOGLESERVICE_INFO_FILE}"
    if [ ! -f $GOOGLESERVICE_INFO_FILE ]
    then
      echo "No GoogleService-Info.plist found. Please ensure it's in the proper directory."
      exit 1
    fi

    # Get a reference to the destination location for the GoogleService-Info.plist
    # This is the default location where Firebase init code expects to find GoogleServices-Info.plist file
    PLIST_DESTINATION=${BUILT_PRODUCTS_DIR}/${PRODUCT_NAME}.app
    echo "Will copy ${GOOGLESERVICE_INFO_PLIST} to final destination: ${PLIST_DESTINATION}"

    # Copy over the prod GoogleService-Info.plist for Release builds
    cp "${GOOGLESERVICE_INFO_FILE}" "${PLIST_DESTINATION}"
  SCRIPT

  # 找到 "Resources" Build Phase
  resources_phase = target.build_phases.find { |p| p.display_name == 'Resources' }

  # 將 "copy google-service plist to flavor" Build Phase 插入到 "Resources" Build Phase 之前
  index = target.build_phases.index(resources_phase)
  #target.build_phases.insert(index, shell_script_phase)
  target.build_phases.move(shell_script_phase, index)
  project.save()
  
else
  pp "google-service plist to flavor already exists"
end
# 保存更改
project.save()


project_path = 'Runner.xcodeproj'
config_folder_path = 'config'


# 查找名稱為「config」的資料夾參考
config_group = project.groups.find { |group| group.display_name == 'config' }

# 如果資料夾參考不存在，則建立一個新的資料夾參考
if config_group.nil?
  config_group = project.new_group('config')
end

# 查找 config 資料夾是否已經存在於專案中
config_folder_reference = config_group.children.find { |child| child.path == config_folder_path }

# 如果 config 資料夾不存在，則建立一個新的資料夾參考
if config_folder_reference.nil?
  config_folder_reference = config_group.new_reference(config_folder_path)
end

# 將 config 資料夾參考加入到所有的 targets 中
project.targets.each do |target|
  target.add_file_references([config_folder_reference])
end

# 設定 config 資料夾參考為「Copy items if needed」
config_folder_reference.set_source_tree('SOURCE_ROOT')
config_folder_reference.set_path(config_folder_path)


file_reference_path = 'Runner/GoogleService-Info.plist'

# 查找要移除的 PBXFileReference
file_reference = project.files.find { |file| file.path == file_reference_path }

# 如果 PBXFileReference 存在，則從專案中移除它
if file_reference
  file_reference.remove_from_project
end

# 儲存 Xcode 專案
project.save()

# def addfiles(direc, current_group, main_target, changed = false)
#   puts "addfiles - `direct`=`#{direc}`, `current_group`=`#{current_group}`, `main_target`=`#{main_target}`"
#   Dir.glob(direc) do |item|
#     puts "addfiles - `item`=`#{item}`"
#       next puts "Next because `.` or `.DS_Store`" if item == '.' or item == '.DS_Store'
#       next puts "Next because file (`#{File.basename(item)}`) was in `current_group.children` (#{current_group})" if current_group.children.map { |f| f.name }.include? File.basename(item)
#       if File.directory?(item)
#           new_folder = File.basename(item)
#           created_group = current_group.new_group(new_folder)
#           changed = addfiles("#{item}/*", created_group, main_target, changed)
#       else 
#         i = current_group.new_file(item)
#         if item.include? ".plist"
#             main_target.add_file_references([i])
#             changed = true
#         end
#       end
#   end
#   return changed
#   end

# def add_group_to_project(project_path, name_of_generated_folder)
#   project = Xcodeproj::Project.open(project_path)

#   generated_group = project.main_group[name_of_generated_folder]
#   unless generated_group
#   generated_group = project.main_group.new_group(name_of_generated_folder)
#   end

#   main_target = project.targets.first
#   added_new_files = addfiles("#{name_of_generated_folder}/*", generated_group, main_target)

#   if added_new_files
#           project.save
#       end
#   end

# puts "`project_path`=`#{project_path}`"
# pp Dir.pwd
# add_group_to_project(project_path, 'config')