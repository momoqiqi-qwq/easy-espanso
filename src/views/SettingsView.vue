<template>
  <div class="settings-view bg-background">
    <AppUpdatePanel />
    <!-- 加载状态 -->
    <div v-if="!isConfigLoaded && !loadError" class="loading-view">
      <div class="spinner"></div>
      <p class="mt-4 text-primary font-medium">{{ t('settings.loadingConfig') }}</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="loadError" class="error-view">
      <div class="alert-icon">❌</div>
      <p class="error-message">{{ loadError }}</p>
      <Button @click="tryReload" class="mt-4">{{ t('settings.retryLoad') }}</Button>
    </div>

    <!-- 正常设置内容 -->
    <div v-else class="content-view flex flex-col">
      <div class="flex flex-wrap justify-between items-center gap-3 mb-3">
        <h1 class="text-2xl font-bold">{{ t('settings.title') }}</h1>
        <div class="flex items-center gap-2">
          <Button variant="outline" @click="resetToDefault" :disabled="!hasChanges || isSaving">
            <Undo2 class="w-4 h-4 mr-2" />
            {{ t('settings.discardChanges') }}
          </Button>
          <Button @click="saveSettings" :disabled="!hasChanges || isSaving">
            <Save v-if="!isSaving" class="w-4 h-4 mr-2" />
            <span v-if="isSaving" class="loader mr-2"></span>
            {{ isSaving ? t('settings.savingSettings') : t('settings.saveSettings') }}
          </Button>
        </div>
      </div>
      
      <Separator class="my-4" />

      <div class="settings-toolbar mb-4">
        <div class="settings-search">
          <Search class="w-4 h-4 text-muted-foreground" />
          <Input v-model="settingsSearch" :placeholder="t('settings.searchPlaceholder')" class="border-0 shadow-none focus-visible:ring-0" />
          <button v-if="settingsSearch" type="button" class="search-clear" @click="settingsSearch = ''" :aria-label="t('settings.clearSearch')">×</button>
        </div>
        <div class="text-xs text-muted-foreground">{{ t('settings.searchHint') }}</div>
      </div>
      
      <div class="settings-container flex-1">
        <!-- 设置分类侧边栏 -->
        <div class="settings-sidebar">
          <button
            v-for="category in filteredCategories"
            :key="category.id"
            type="button"
            @click="selectCategory(category.id)"
            class="category-item"
            :class="{ active: activeCategory === category.id }"
            :aria-current="activeCategory === category.id ? 'page' : undefined"
          >
            <component :is="icons[category.icon]" class="w-5 h-5 mr-2" />
            <span>{{ t(`settings.sections.${category.id}`) }}</span>
          </button>
        </div>
        
        <!-- 设置内容区域 -->
        <div class="settings-content">
          <h2 class="text-xl font-semibold mb-4">{{ t(`settings.sections.${activeCategory}`) }}</h2>
          
          <!-- 基本设置 -->
          <div v-if="activeCategory === 'basic'" class="grid grid-cols-2 gap-4">
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="toggle_key">{{ t('settings.basicSettings.toggleKey') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.basicSettings.toggleKeyTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select v-model="localConfig.toggle_key">
                <SelectTrigger id="toggle_key" class="w-full">
                  <SelectValue :placeholder="t('settings.selectLanguagePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALT">ALT</SelectItem>
                  <SelectItem value="CTRL">CTRL</SelectItem>
                  <SelectItem value="CMD">CMD</SelectItem>
                  <SelectItem value="SHIFT">SHIFT</SelectItem>
                  <SelectItem value="OFF">{{ t('settings.selectOptions.disabled') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="backend">{{ t('settings.basicSettings.backendType') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.basicSettings.backendTypeTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select v-model="localConfig.backend">
                <SelectTrigger id="backend" class="w-full">
                  <SelectValue :placeholder="t('settings.selectLanguagePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Auto">{{ t('settings.selectOptions.auto') }}</SelectItem>
                  <SelectItem value="Inject">{{ t('settings.selectOptions.inject') }}</SelectItem>
                  <SelectItem value="Clipboard">{{ t('settings.selectOptions.clipboard') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="search_shortcut">{{ t('settings.basicSettings.searchShortcut') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.basicSettings.searchShortcutTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="search_shortcut" v-model="localConfig.search_shortcut" />
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="auto_restart" v-model="localConfig.auto_restart" />
                  <Label for="auto_restart">{{ t('settings.basicSettings.autoRestart') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.basicSettings.autoRestartTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p class="text-xs text-gray-500 mt-1">{{ t('settings.basicSettings.autoRestartHint') }}</p>
            </div>

            <!-- 语言选择器 -->
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="language">{{ t('settings.language') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.languageTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select v-model="localConfig.language">
                <SelectTrigger id="language" class="w-full">
                  <SelectValue :placeholder="t('settings.selectLanguagePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="loc in availableLocales" :key="loc" :value="loc">
                    {{ t(`settings.languageNames.${loc.replace('-', '')}`) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- 主题选择器 -->
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="theme">{{ t('settings.theme') }}</Label>
                 <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.themeTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select v-model="selectedAppTheme">
                <SelectTrigger id="theme" class="w-full">
                  <SelectValue :placeholder="t('settings.selectThemePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{{ t('settings.themes.light') }}</SelectItem>
                  <SelectItem value="dark">{{ t('settings.themes.dark') }}</SelectItem>
                  <SelectItem value="system">{{ t('settings.themes.system') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- 界面偏好（仅影响 Easy Espanso，不写入 Espanso 配置） -->
          <div v-if="activeCategory === 'interface'" class="grid grid-cols-2 gap-4">
            <ExtensionPreferencesPanel />
            <div class="form-item">
              <Label for="interface_density">{{ t('settings.interfaceSettings.density') }}</Label>
              <Select v-model="interfaceDensity">
                <SelectTrigger id="interface_density" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">{{ t('settings.interfaceSettings.compact') }}</SelectItem>
                  <SelectItem value="comfortable">{{ t('settings.interfaceSettings.comfortable') }}</SelectItem>
                  <SelectItem value="spacious">{{ t('settings.interfaceSettings.spacious') }}</SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground mt-1">{{ t('settings.interfaceSettings.densityHint') }}</p>
            </div>

            <div class="form-item">
              <div class="flex items-center space-x-2">
                <Checkbox id="expand_on_row_click" v-model="expandOnRowClick" />
                <Label for="expand_on_row_click">{{ t('settings.interfaceSettings.expandOnRowClick') }}</Label>
              </div>
              <p class="text-xs text-muted-foreground mt-1">{{ t('settings.interfaceSettings.expandOnRowClickHint') }}</p>
            </div>

            <div class="form-item">
              <div class="flex items-center space-x-2">
                <Checkbox id="auto_expand_search" v-model="autoExpandOnSearch" />
                <Label for="auto_expand_search">{{ t('settings.interfaceSettings.autoExpandOnSearch') }}</Label>
              </div>
            </div>

            <div class="form-item">
              <div class="flex items-center space-x-2">
                <Checkbox id="remember_tree_state" v-model="rememberTreeState" />
                <Label for="remember_tree_state">{{ t('settings.interfaceSettings.rememberTreeState') }}</Label>
              </div>
            </div>

            <div class="form-item">
              <div class="flex items-center space-x-2">
                <Checkbox id="show_match_descriptions" v-model="showMatchDescriptions" />
                <Label for="show_match_descriptions">{{ t('settings.interfaceSettings.showMatchDescriptions') }}</Label>
              </div>
            </div>

            <div class="form-item">
              <div class="flex items-center space-x-2">
                <Checkbox id="reduce_motion" v-model="reduceMotion" />
                <Label for="reduce_motion">{{ t('settings.interfaceSettings.reduceMotion') }}</Label>
              </div>
              <p class="text-xs text-muted-foreground mt-1">{{ t('settings.interfaceSettings.reduceMotionHint') }}</p>
            </div>

            <div class="col-span-2 rounded-lg border bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
              {{ t('settings.interfaceSettings.applyImmediately') }}
            </div>

            <div class="form-item col-span-2">
              <Label>{{ t('settings.interfaceSettings.accentColor') }}</Label>
              <div class="accent-presets" role="radiogroup" :aria-label="t('settings.interfaceSettings.accentColor')">
                <button
                  v-for="preset in accentPresets"
                  :key="preset.id"
                  type="button"
                  class="accent-preset"
                  :class="{ active: accentColor === preset.id }"
                  :aria-checked="accentColor === preset.id"
                  role="radio"
                  :title="preset.label"
                  @click="accentColor = preset.id"
                >
                  <span class="accent-swatch" :style="{ background: `hsl(${preset.hsl})` }"></span>
                  <span>{{ preset.label }}</span>
                </button>
              </div>
              <p class="text-xs text-muted-foreground mt-1">{{ t('settings.interfaceSettings.accentColorHint') }}</p>
            </div>

            <div class="form-item">
              <Label for="scrollbar_size">{{ t('settings.interfaceSettings.scrollbarSize') }}</Label>
              <Select v-model="scrollbarSize">
                <SelectTrigger id="scrollbar_size" class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slim">{{ t('settings.interfaceSettings.scrollbarSlim') }}</SelectItem>
                  <SelectItem value="standard">{{ t('settings.interfaceSettings.scrollbarStandard') }}</SelectItem>
                  <SelectItem value="wide">{{ t('settings.interfaceSettings.scrollbarWide') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="form-item">
              <Label for="font_scale">{{ t('settings.interfaceSettings.fontScale') }}</Label>
              <Select v-model="fontScaleValue">
                <SelectTrigger id="font_scale" class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="90">90%</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
                  <SelectItem value="110">110%</SelectItem>
                  <SelectItem value="125">125%</SelectItem>
                  <SelectItem value="150">150%</SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground mt-1">{{ t('settings.interfaceSettings.fontScaleHint') }}</p>
            </div>

            <div class="form-item">
              <Label for="sidebar_size">{{ t('settings.interfaceSettings.sidebarSize') }}</Label>
              <Select v-model="sidebarSize">
                <SelectTrigger id="sidebar_size" class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">{{ t('settings.interfaceSettings.sidebarCompact') }}</SelectItem>
                  <SelectItem value="standard">{{ t('settings.interfaceSettings.sidebarStandard') }}</SelectItem>
                  <SelectItem value="wide">{{ t('settings.interfaceSettings.sidebarWide') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="form-item">
              <div class="flex items-center space-x-2">
                <Checkbox id="show_sidebar_labels" v-model="showSidebarLabels" />
                <Label for="show_sidebar_labels">{{ t('settings.interfaceSettings.showSidebarLabels') }}</Label>
              </div>
            </div>

            <div class="form-item">
              <Label for="drag_activation_delay">{{ t('settings.interfaceSettings.dragActivationDelay') }}</Label>
              <Select v-model="dragActivationDelayValue">
                <SelectTrigger id="drag_activation_delay" class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="120">{{ t('settings.interfaceSettings.dragDelayFast') }}</SelectItem>
                  <SelectItem value="180">{{ t('settings.interfaceSettings.dragDelayRecommended') }}</SelectItem>
                  <SelectItem value="250">{{ t('settings.interfaceSettings.dragDelaySafe') }}</SelectItem>
                  <SelectItem value="350">{{ t('settings.interfaceSettings.dragDelaySlow') }}</SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground mt-1">{{ t('settings.interfaceSettings.dragActivationDelayHint') }}</p>
            </div>

            <div class="form-item">
              <Label for="middle_pane_width">{{ t('settings.interfaceSettings.middlePaneWidth') }}</Label>
              <Select v-model="middlePaneWidthValue">
                <SelectTrigger id="middle_pane_width" class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="300">300 px</SelectItem>
                  <SelectItem value="350">350 px</SelectItem>
                  <SelectItem value="420">420 px</SelectItem>
                  <SelectItem value="500">500 px</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="form-item">
              <Label for="tree_indent_size">{{ t('settings.interfaceSettings.treeIndentSize') }}</Label>
              <Select v-model="treeIndentSizeValue">
                <SelectTrigger id="tree_indent_size" class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="14">14 px</SelectItem>
                  <SelectItem value="18">18 px</SelectItem>
                  <SelectItem value="20">20 px</SelectItem>
                  <SelectItem value="24">24 px</SelectItem>
                  <SelectItem value="28">28 px</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="form-item col-span-2">
              <Label>{{ t('settings.interfaceSettings.sidebarOrder') }}</Label>
              <p class="text-xs text-muted-foreground mt-1 mb-2">{{ t('settings.interfaceSettings.sidebarOrderHint') }}</p>
              <VueDraggable
                v-model="sidebarOrder"
                class="sidebar-order-preview"
                handle=".sidebar-order-handle"
                :animation="150"
              >
                <div v-for="item in sidebarOrder" :key="item" class="sidebar-order-item">
                  <GripVertical class="sidebar-order-handle w-4 h-4" />
                  <span>{{ t(`sidebar.${item}`) }}</span>
                </div>
              </VueDraggable>
            </div>

            <div class="form-item">
              <div class="flex items-center space-x-2">
                <Checkbox id="check_espanso_startup" v-model="checkEspansoOnStartup" />
                <Label for="check_espanso_startup">{{ t('settings.interfaceSettings.checkEspansoOnStartup') }}</Label>
              </div>
              <p class="text-xs text-muted-foreground mt-1">{{ t('settings.interfaceSettings.checkEspansoOnStartupHint') }}</p>
            </div>

            <div class="form-item">
              <div class="flex items-center space-x-2">
                <Checkbox id="warn_unsaved" v-model="warnUnsavedChanges" />
                <Label for="warn_unsaved">{{ t('settings.interfaceSettings.warnUnsavedChanges') }}</Label>
              </div>
            </div>

            <div class="form-item">
              <Label for="toast_position">{{ t('settings.interfaceSettings.toastPosition') }}</Label>
              <Select v-model="toastPosition">
                <SelectTrigger id="toast_position" class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="top-left">{{ t('settings.interfaceSettings.topLeft') }}</SelectItem>
                  <SelectItem value="top-center">{{ t('settings.interfaceSettings.topCenter') }}</SelectItem>
                  <SelectItem value="top-right">{{ t('settings.interfaceSettings.topRight') }}</SelectItem>
                  <SelectItem value="bottom-left">{{ t('settings.interfaceSettings.bottomLeft') }}</SelectItem>
                  <SelectItem value="bottom-center">{{ t('settings.interfaceSettings.bottomCenter') }}</SelectItem>
                  <SelectItem value="bottom-right">{{ t('settings.interfaceSettings.bottomRight') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="form-item">
              <Label for="toast_duration">{{ t('settings.interfaceSettings.toastDuration') }}</Label>
              <Select v-model="toastDurationValue">
                <SelectTrigger id="toast_duration" class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1500">1.5s</SelectItem>
                  <SelectItem value="2500">2.5s</SelectItem>
                  <SelectItem value="4000">4s</SelectItem>
                  <SelectItem value="6000">6s</SelectItem>
                </SelectContent>
              </Select>
            </div>



            <div class="form-item">
              <Label for="history_limit">{{ t('settings.interfaceSettings.historyLimit') }}</Label>
              <Select v-model="historyLimitValue">
                <SelectTrigger id="history_limit" class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="60">60</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground mt-1">{{ t('settings.interfaceSettings.historyLimitHint') }}</p>
            </div>

            <div class="form-item">
              <div class="flex items-center space-x-2">
                <Checkbox id="confirm_before_delete" v-model="confirmBeforeDelete" />
                <Label for="confirm_before_delete">{{ t('settings.interfaceSettings.confirmBeforeDelete') }}</Label>
              </div>
              <p class="text-xs text-muted-foreground mt-1">{{ t('settings.interfaceSettings.confirmBeforeDeleteHint') }}</p>
            </div>

            <div class="form-item">
              <div class="flex items-center space-x-2">
                <Checkbox id="auto_rename_new_items" v-model="autoRenameNewItems" />
                <Label for="auto_rename_new_items">{{ t('settings.interfaceSettings.autoRenameNewItems') }}</Label>
              </div>
              <p class="text-xs text-muted-foreground mt-1">{{ t('settings.interfaceSettings.autoRenameNewItemsHint') }}</p>
            </div>

            <div class="col-span-2 preference-backup-card">
              <div>
                <div class="font-medium">{{ t('settings.interfaceSettings.preferenceBackup') }}</div>
                <p class="text-xs text-muted-foreground mt-1">{{ t('settings.interfaceSettings.preferenceBackupHint') }}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button variant="outline" type="button" @click="exportUserPreferences">
                  <Download class="w-4 h-4 mr-2" />{{ t('settings.interfaceSettings.exportPreferences') }}
                </Button>
                <Button variant="outline" type="button" @click="openPreferenceImport">
                  <Upload class="w-4 h-4 mr-2" />{{ t('settings.interfaceSettings.importPreferences') }}
                </Button>
                <input ref="preferenceFileInput" class="hidden" type="file" accept="application/json,.json" @change="importUserPreferences" />
              </div>
            </div>

            <div class="col-span-2 pt-2 flex flex-wrap gap-2 items-center">
              <Button variant="outline" type="button" @click="resetInterfacePreferencesSafely">
                <RotateCcw class="w-4 h-4 mr-2" />
                {{ t('settings.interfaceSettings.reset') }}
              </Button>
            </div>
          </div>
          
          <!-- Espanso 工具：运行状态、手动路径和快捷控制 -->
          <EspansoToolsPanel v-if="activeCategory === 'espanso'" />

          <!-- 通知设置 -->
          <div v-if="activeCategory === 'notification'" class="grid grid-cols-2 gap-4">
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="enable_notifications" v-model="localConfig.enable_notifications" />
                  <Label for="enable_notifications">{{ t('settings.notificationSettings.enableNotifications') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.notificationSettings.enableNotificationsTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="show_icon" v-model="localConfig.show_icon" />
                  <Label for="show_icon">{{ t('settings.notificationSettings.showIcon') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.notificationSettings.showIconTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="notification_icon">{{ t('settings.notificationSettings.notificationIcon') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.notificationSettings.notificationIconTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="notification_icon" v-model="localConfig.notification_icon" />
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="notification_sound">{{ t('settings.notificationSettings.notificationSound') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.notificationSettings.notificationSoundTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="notification_sound" v-model="localConfig.notification_sound" />
            </div>
          </div>
          
          <!-- 粘贴行为 -->
          <div v-if="activeCategory === 'paste'" class="grid grid-cols-2 gap-4">
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="prefer_clipboard" v-model="localConfig.prefer_clipboard" />
                  <Label for="prefer_clipboard">{{ t('settings.pasteSettings.preferClipboard') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.pasteSettings.preferClipboardTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <!-- 剪贴板阈值 -->
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="clipboard_threshold">{{ t('settings.pasteSettings.clipboardThreshold') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.pasteSettings.clipboardThresholdTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="clipboard_threshold" type="number" v-model.number="localConfig.clipboard_threshold" />
            </div>
            
            <!-- 粘贴快捷键 -->
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="paste_shortcut">{{ t('settings.pasteSettings.pasteShortcut') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.pasteSettings.pasteShortcutTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="paste_shortcut" v-model="localConfig.paste_shortcut" />
            </div>
            
            <!-- 快速注入 -->
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="fast_inject" v-model="localConfig.fast_inject" />
                  <Label for="fast_inject">{{ t('settings.pasteSettings.fastInject') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.pasteSettings.fastInjectTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="pre_paste_delay">{{ t('settings.pasteSettings.prePasteDelay') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.pasteSettings.prePasteDelayTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="pre_paste_delay" type="number" v-model.number="localConfig.pre_paste_delay" />
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="post_paste_delay">{{ t('settings.pasteSettings.postPasteDelay') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.pasteSettings.postPasteDelayTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="post_paste_delay" type="number" v-model.number="localConfig.post_paste_delay" />
            </div>
          </div>
          
          <!-- macOS 特定设置 -->
          <div v-if="activeCategory === 'mac' && isMacOS" class="grid grid-cols-2 gap-4">
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="mac_use_applescript_backend" v-model="localConfig.mac_use_applescript_backend" />
                  <Label for="mac_use_applescript_backend">{{ t('settings.macSettings.useAppleScriptBackend') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.macSettings.useAppleScriptBackendTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="mac_use_events_backend" v-model="localConfig.mac_use_events_backend" />
                  <Label for="mac_use_events_backend">{{ t('settings.macSettings.useEventsBackend') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.macSettings.useEventsBackendTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="mac_experimental_accessibility" v-model="localConfig.mac_experimental_accessibility" />
                  <Label for="mac_experimental_accessibility">{{ t('settings.macSettings.experimentalAccessibility') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.macSettings.experimentalAccessibilityTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
          
          <!-- Windows 特定设置 -->
          <div v-if="activeCategory === 'windows' && isWindows" class="grid grid-cols-2 gap-4">
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="win_use_legacy_inject" v-model="localConfig.win_use_legacy_inject" />
                  <Label for="win_use_legacy_inject">{{ t('settings.windowsSettings.useLegacyInject') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.windowsSettings.useLegacyInjectTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="win_use_send_input_backend" v-model="localConfig.win_use_send_input_backend" />
                  <Label for="win_use_send_input_backend">{{ t('settings.windowsSettings.useSendInputBackend') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.windowsSettings.useSendInputBackendTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
          
          <!-- Linux 特定设置 -->
          <div v-if="activeCategory === 'linux' && isLinux" class="grid grid-cols-2 gap-4">
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="x11_use_xdotool_backend" v-model="localConfig.x11_use_xdotool_backend" />
                  <Label for="x11_use_xdotool_backend">{{ t('settings.linuxSettings.useXdotoolBackend') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.linuxSettings.useXdotoolBackendTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="x11_use_xsel_backend" v-model="localConfig.x11_use_xsel_backend" />
                  <Label for="x11_use_xsel_backend">{{ t('settings.linuxSettings.useXselBackend') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.linuxSettings.useXselBackendTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="x11_key_delay">{{ t('settings.linuxSettings.x11KeyDelay') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.linuxSettings.x11KeyDelayTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="x11_key_delay" type="number" v-model.number="localConfig.x11_key_delay" />
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="wayland_paste_method">{{ t('settings.linuxSettings.waylandPasteMethod') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.linuxSettings.waylandPasteMethodTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select v-model="localConfig.wayland_paste_method">
                <SelectTrigger id="wayland_paste_method" class="w-full">
                  <SelectValue :placeholder="t('settings.selectLanguagePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clipboard">{{ t('settings.selectOptions.clipboard') }}</SelectItem>
                  <SelectItem value="keyboard">{{ t('settings.selectOptions.keyboard') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <!-- 备份、导入与 packages 修复 -->
          <div v-if="activeCategory === 'advanced'" class="mb-5 rounded-lg border p-4">
            <h3 class="font-semibold mb-2">配置备份与 Packages</h3>
            <p class="text-sm text-muted-foreground mb-4">导出会备份 config、match 和 packages；导入时可选择保留当前片段，避免覆盖现有 match。</p>
            <div class="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" @click="openPackagesFolder">打开 packages 文件夹</Button>
              <Button type="button" variant="outline" @click="createPackagesFolder">新建 / 修复 packages 文件夹</Button>
              <Button type="button" variant="outline" :disabled="backupBusy" @click="exportFullBackup">
                <Download class="w-4 h-4 mr-2" />导出完整配置
              </Button>
              <Button type="button" variant="outline" :disabled="backupBusy" @click="importFullBackup">
                <Upload class="w-4 h-4 mr-2" />导入配置
              </Button>
            </div>
            <div class="flex items-center gap-2 mt-4">
              <Checkbox id="preserve-current-matches" v-model="preserveCurrentMatches" />
              <Label for="preserve-current-matches">导入时保留当前片段（不覆盖 match）</Label>
            </div>
            <p v-if="packagesFolderPath" class="mt-3 text-xs text-muted-foreground break-all">packages: {{ packagesFolderPath }}</p>
          </div>

          <!-- 工作区与安全编辑 -->
          <div v-if="activeCategory === 'advanced'" class="mb-5 rounded-lg border p-4">
            <h3 class="font-semibold mb-3">安全编辑与工作区</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex items-center gap-2"><Checkbox id="auto-save" v-model="autoSave"/><Label for="auto-save">自动保存编辑</Label></div>
              <div class="flex items-center gap-2"><Checkbox id="backup-save" v-model="backupBeforeSave"/><Label for="backup-save">保存前创建 .easy-espanso.bak 备份</Label></div>
              <div class="form-item">
                <Label for="recent-workspace-limit">最近工作区数量</Label>
                <Select v-model="maxRecentWorkspacesValue">
                  <SelectTrigger id="recent-workspace-limit" class="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="12">12</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="form-item flex items-end">
                <Button type="button" variant="outline" class="w-full" :disabled="recentWorkspaces.length === 0" @click="clearRecentWorkspaces">清空最近工作区</Button>
              </div>
            </div>
            <div v-if="recentWorkspaces.length" class="mt-4">
              <Label>最近工作区</Label>
              <div class="mt-2 space-y-1 text-xs text-muted-foreground">
                <div v-for="w in recentWorkspaces" :key="w.path" class="truncate" :title="w.path">{{ w.path }}</div>
              </div>
            </div>
          </div>
          <!-- 高级设置 -->
          <div v-if="activeCategory === 'advanced'" class="grid grid-cols-2 gap-4">
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="inject_delay">{{ t('settings.advancedSettings.injectDelay') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.advancedSettings.injectDelayTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="inject_delay" type="number" v-model.number="localConfig.inject_delay" />
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="abort_key">{{ t('settings.advancedSettings.abortKey') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.advancedSettings.abortKeyTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select v-model="localConfig.abort_key">
                <SelectTrigger id="abort_key" class="w-full">
                  <SelectValue :placeholder="t('settings.advancedSettings.selectAbortKey')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ESC">ESC</SelectItem>
                  <SelectItem value="CTRL+C">CTRL+C</SelectItem>
                  <SelectItem value="ALT+C">ALT+C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="filter_class">{{ t('settings.advancedSettings.filterClass') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.advancedSettings.filterClassTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="filter_class" v-model="localConfig.filter_class" />
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="filter_title">{{ t('settings.advancedSettings.filterTitle') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.advancedSettings.filterTitleTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="filter_title" v-model="localConfig.filter_title" />
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="config_path">{{ t('settings.advancedSettings.configPath') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.advancedSettings.configPathTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="config_path" v-model="localConfig.config_path" />
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="packages_path">{{ t('settings.advancedSettings.packagesPath') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.advancedSettings.packagesPathTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="packages_path" v-model="localConfig.packages_path" />
            </div>
          </div>
          
          <!-- 日志设置 -->
          <div v-if="activeCategory === 'logging'" class="grid grid-cols-2 gap-4">
            <div class="form-item">
              <div class="flex items-center gap-1">
                <div class="flex items-center space-x-2">
                  <Checkbox id="verbose" v-model="localConfig.verbose" />
                  <Label for="verbose">{{ t('settings.loggingSettings.verbose') }}</Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.loggingSettings.verboseTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="log_level">{{ t('settings.loggingSettings.logLevel') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.loggingSettings.logLevelTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select v-model="localConfig.log_level">
                <SelectTrigger id="log_level" class="w-full">
                  <SelectValue :placeholder="t('settings.loggingSettings.selectLogLevel')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trace">Trace</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="log_file">{{ t('settings.loggingSettings.logFile') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.loggingSettings.logFileTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="log_file" v-model="localConfig.log_file" />
            </div>
            
            <div class="form-item">
              <div class="flex items-center gap-1">
                <Label for="log_filter">{{ t('settings.loggingSettings.logFilter') }}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div class="cursor-help text-muted-foreground">
                        <HelpCircleIcon class="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p class="max-w-xs">{{ t('settings.loggingSettings.logFilterTooltip') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="log_filter" v-model="localConfig.log_filter" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, onErrorCaptured } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useEspansoStore } from "@/store/useEspansoStore";
import { useUserPreferences } from "@/store/useUserPreferences";
import { cloneDeep, isEqual } from "lodash-es";
import { toast } from "vue-sonner";
import { useI18n } from 'vue-i18n';
import { useTheme } from '../hooks/useTheme';
import {
  Settings,
  Save,
  AlertTriangle,
  Clock,
  Bell,
  Laptop,
  Monitor,
  Server,
  LineChart,
  HelpCircleIcon,
  SlidersHorizontal,
  RotateCcw,
  Wrench,
  Undo2,
  GripVertical,
  Search,
  Download,
  Upload,
} from "lucide-vue-next";
import type { FunctionalComponent } from "vue";

// UI组件
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "../components/ui/separator";
import EspansoToolsPanel from '@/components/settings/EspansoToolsPanel.vue';
import ExtensionPreferencesPanel from '@/components/settings/ExtensionPreferencesPanel.vue';
import AppUpdatePanel from '@/components/settings/AppUpdatePanel.vue';
import type { AccentColor, FontScale, ScrollbarSize, ToastDuration, ToastPosition, HistoryLimit } from '@/store/useUserPreferences';
import * as workspaceService from '@/services/workspaceService';
import * as platformService from '@/services/platformService';
import { VueDraggable } from 'vue-draggable-plus';
import type { DragActivationDelay, MiddlePaneWidth, TreeIndentSize, SidebarRouteId } from '@/store/useUserPreferences';

// 获取 i18n 函数和状态
const { t, locale, availableLocales } = useI18n();

// 获取主题设置
const { theme: appTheme, setTheme: setAppTheme } = useTheme();

// 获取store
const store = useEspansoStore();
const userPreferences = useUserPreferences();
const route = useRoute();
const router = useRouter();

const interfaceDensity = computed({
  get: () => userPreferences.preferences.interfaceDensity,
  set: (value) => userPreferences.updatePreference('interfaceDensity', value),
});
const reduceMotion = computed({
  get: () => userPreferences.preferences.reduceMotion,
  set: (value) => userPreferences.updatePreference('reduceMotion', value),
});
const rememberTreeState = computed({
  get: () => userPreferences.preferences.rememberTreeState,
  set: (value) => userPreferences.updatePreference('rememberTreeState', value),
});
const autoExpandOnSearch = computed({
  get: () => userPreferences.preferences.autoExpandOnSearch,
  set: (value) => userPreferences.updatePreference('autoExpandOnSearch', value),
});
const expandOnRowClick = computed({
  get: () => userPreferences.preferences.expandOnRowClick,
  set: (value) => userPreferences.updatePreference('expandOnRowClick', value),
});
const showMatchDescriptions = computed({
  get: () => userPreferences.preferences.showMatchDescriptions,
  set: (value) => userPreferences.updatePreference('showMatchDescriptions', value),
});
const fontScaleValue = computed({
  get: () => String(userPreferences.preferences.fontScale),
  set: (value: string) => userPreferences.updatePreference('fontScale', Number(value) as FontScale),
});
const accentColor = computed({
  get: () => userPreferences.preferences.accentColor,
  set: (value: AccentColor) => userPreferences.updatePreference('accentColor', value),
});
const scrollbarSize = computed({
  get: () => userPreferences.preferences.scrollbarSize,
  set: (value: ScrollbarSize) => userPreferences.updatePreference('scrollbarSize', value),
});
const accentPresets: Array<{ id: AccentColor; label: string; hsl: string }> = [
  { id: 'blue', label: '蓝', hsl: '224 76% 48%' },
  { id: 'violet', label: '紫', hsl: '262 83% 58%' },
  { id: 'cyan', label: '青', hsl: '190 90% 40%' },
  { id: 'emerald', label: '绿', hsl: '160 84% 39%' },
  { id: 'amber', label: '橙', hsl: '32 95% 44%' },
  { id: 'rose', label: '玫红', hsl: '347 77% 50%' },
];
const sidebarSize = computed({
  get: () => userPreferences.preferences.sidebarSize,
  set: (value) => userPreferences.updatePreference('sidebarSize', value),
});
const showSidebarLabels = computed({
  get: () => userPreferences.preferences.showSidebarLabels,
  set: (value) => userPreferences.updatePreference('showSidebarLabels', value),
});
const dragActivationDelayValue = computed({
  get: () => String(userPreferences.preferences.dragActivationDelay),
  set: (value: string) => userPreferences.updatePreference('dragActivationDelay', Number(value) as DragActivationDelay),
});
const middlePaneWidthValue = computed({
  get: () => String(userPreferences.preferences.middlePaneWidth),
  set: (value: string) => userPreferences.updatePreference('middlePaneWidth', Number(value) as MiddlePaneWidth),
});
const treeIndentSizeValue = computed({
  get: () => String(userPreferences.preferences.treeIndentSize),
  set: (value: string) => userPreferences.updatePreference('treeIndentSize', Number(value) as TreeIndentSize),
});
const sidebarOrder = computed<SidebarRouteId[]>({
  get: () => [...userPreferences.preferences.sidebarOrder],
  set: (value) => userPreferences.updatePreference('sidebarOrder', [...value]),
});
const checkEspansoOnStartup = computed({
  get: () => userPreferences.preferences.checkEspansoOnStartup,
  set: (value) => userPreferences.updatePreference('checkEspansoOnStartup', value),
});
const toastPosition = computed({
  get: () => userPreferences.preferences.toastPosition,
  set: (value: ToastPosition) => userPreferences.updatePreference('toastPosition', value),
});
const toastDurationValue = computed({
  get: () => String(userPreferences.preferences.toastDuration),
  set: (value: string) => userPreferences.updatePreference('toastDuration', Number(value) as ToastDuration),
});

const historyLimitValue = computed({
  get: () => String(userPreferences.preferences.historyLimit),
  set: (value: string) => userPreferences.updatePreference('historyLimit', Number(value) as HistoryLimit),
});
const confirmBeforeDelete = computed({
  get: () => userPreferences.preferences.confirmBeforeDelete,
  set: (value: boolean) => userPreferences.updatePreference('confirmBeforeDelete', value),
});
const autoRenameNewItems = computed({
  get: () => userPreferences.preferences.autoRenameNewItems,
  set: (value: boolean) => userPreferences.updatePreference('autoRenameNewItems', value),
});

const warnUnsavedChanges = computed({
  get: () => !userPreferences.preferences.hideUnsavedChangesWarning,
  set: (value) => userPreferences.updatePreference('hideUnsavedChangesWarning', !value),
});
const autoSave = computed({ get: () => userPreferences.preferences.autoSave, set: (v) => userPreferences.updatePreference('autoSave', v) });
const backupBeforeSave = computed({ get: () => userPreferences.preferences.backupBeforeSave, set: (v) => userPreferences.updatePreference('backupBeforeSave', v) });
const maxRecentWorkspacesValue = computed({
  get: () => String(userPreferences.preferences.maxRecentWorkspaces),
  set: (value: string) => userPreferences.updatePreference('maxRecentWorkspaces', Number(value)),
});
const recentWorkspaces = ref(workspaceService.getRecentWorkspaces());
const clearRecentWorkspaces = () => {
  workspaceService.clearRecentWorkspaces();
  recentWorkspaces.value = [];
  toast.success('最近工作区记录已清空');
};
const preferenceFileInput = ref<HTMLInputElement | null>(null);
const openPreferenceImport = () => preferenceFileInput.value?.click();
const exportUserPreferences = () => {
  const blob = new Blob([userPreferences.exportPreferences()], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `easy-espanso-preferences-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast.success(t('settings.interfaceSettings.exportSuccess'));
};
const importUserPreferences = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    userPreferences.importPreferences(await file.text());
    toast.success(t('settings.interfaceSettings.importSuccess'));
  } catch (error) {
    console.error('导入偏好设置失败:', error);
    toast.error(t('settings.interfaceSettings.importFailed'));
  } finally {
    input.value = '';
  }
};
const resetInterfacePreferencesSafely = () => {
  if (!window.confirm(t('settings.interfaceSettings.resetConfirm'))) return;
  userPreferences.resetInterfacePreferences();
  toast.success(t('settings.interfaceSettings.resetSuccess'));
};
const backupBusy = ref(false);
const preserveCurrentMatches = ref(true);
const packagesFolderPath = ref('');

const resolvePackagesFolder = async () => {
  const root = store.state.configRootDir;
  if (!root) throw new Error('当前还没有加载 Espanso 配置目录');
  const matchDir = await platformService.joinPath(root, 'match');
  const path = await platformService.joinPath(matchDir, 'packages');
  packagesFolderPath.value = path;
  return path;
};

const createPackagesFolder = async () => {
  try {
    const path = await resolvePackagesFolder();
    if (!(await platformService.directoryExists(path))) await platformService.createDirectory(path);
    toast.success('packages 文件夹已准备好');
  } catch (error: any) {
    toast.error(`创建 packages 失败：${error?.message || error}`);
  }
};

const openPackagesFolder = async () => {
  try {
    const path = await resolvePackagesFolder();
    if (!(await platformService.directoryExists(path))) await platformService.createDirectory(path);
    const ok = await platformService.openInExplorer(path);
    if (!ok) throw new Error('系统文件管理器打开失败');
  } catch (error: any) {
    toast.error(`打开 packages 失败：${error?.message || error}`);
  }
};

const exportFullBackup = async () => {
  if (!store.state.configRootDir) return toast.error('请先加载 Espanso 配置目录');
  try {
    backupBusy.value = true;
    const selected = await platformService.showOpenDialog({ title: '选择导出到哪个文件夹', properties: ['openDirectory', 'createDirectory'] });
    if (selected.canceled || !selected.filePaths[0]) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = await platformService.joinPath(selected.filePaths[0], `easy-espanso-backup-${stamp}`);
    const exported = await platformService.exportEspansoBackup(store.state.configRootDir, target);
    toast.success('导出完成');
    await platformService.openInExplorer(exported);
  } catch (error: any) {
    toast.error(`导出失败：${error?.message || error}`);
  } finally {
    backupBusy.value = false;
  }
};

const importFullBackup = async () => {
  if (!store.state.configRootDir) return toast.error('请先加载 Espanso 配置目录');
  try {
    backupBusy.value = true;
    const selected = await platformService.showOpenDialog({ title: '选择 Easy Espanso 备份文件夹', properties: ['openDirectory'] });
    if (selected.canceled || !selected.filePaths[0]) return;
    const result = await platformService.showMessageBox({
      type: 'warning',
      title: '确认导入配置',
      message: preserveCurrentMatches.value ? '将恢复 config 和 packages，并保留当前片段。' : '将恢复 config、packages 和 match，当前片段可能被覆盖。',
      detail: '建议先使用“导出完整配置”创建备份。',
      buttons: ['继续导入', '取消'],
    });
    if (result.response !== 0) return;
    await platformService.importEspansoBackup(selected.filePaths[0], store.state.configRootDir, preserveCurrentMatches.value);
    await store.loadConfig(store.state.configRootDir);
    toast.success(preserveCurrentMatches.value ? '导入完成，当前片段已保留' : '导入完成');
  } catch (error: any) {
    toast.error(`导入失败：${error?.message || error}`);
  } finally {
    backupBusy.value = false;
  }
};

// 平台检测
const isMacOS = computed(() => navigator.platform.includes("Mac"));
const isWindows = computed(() => navigator.platform.includes("Win"));
const isLinux = computed(() => !isMacOS.value && !isWindows.value);

const settingsSearch = ref('');
const categorySearchKeywords: Record<string, string> = {
  basic: 'language hotkey shortcut backend restart 语言 快捷键 后端 重启',
  interface: 'theme color font density sidebar toast history drag tree backup import export 主题 颜色 字体 密度 侧栏 通知 历史 拖拽 缩进 备份 导入 导出',
  espanso: 'status path start stop restart install service 状态 路径 启动 停止 重启 安装 服务',
  paste: 'clipboard paste inject delay threshold 剪贴板 粘贴 注入 延迟 阈值',
  notification: 'notification icon sound 通知 图标 声音',
  advanced: 'advanced abort filter config package backup import export preserve 高级 中止 过滤 配置 路径 packages 备份 导入 导出 保留片段',
  logging: 'log verbose debug 日志 调试',
  mac: 'mac apple accessibility',
  windows: 'windows win inject',
  linux: 'linux x11 wayland xdotool ydotool wtype',
};

// 设置分类
const categories = [
  { id: "basic", name: t('settings.sections.basic'), icon: "Settings" },
  { id: "interface", name: t('settings.sections.interface'), icon: "SlidersHorizontal" },
  { id: "espanso", name: t('settings.sections.espanso'), icon: "Wrench" },
  { id: "paste", name: t('settings.sections.paste'), icon: "Clock" },
  { id: "notification", name: t('settings.sections.notification'), icon: "Bell" },
  { id: "advanced", name: t('settings.sections.advanced'), icon: "AlertTriangle" },
  { id: "logging", name: t('settings.sections.logging'), icon: "LineChart" },
];

// 添加平台特定设置
if (isMacOS.value) {
  categories.push({ id: "mac", name: t('settings.sections.mac'), icon: "Laptop" });
}
if (isWindows.value) {
  categories.push({ id: "windows", name: t('settings.sections.windows'), icon: "Monitor" });
}
if (isLinux.value) {
  categories.push({ id: "linux", name: t('settings.sections.linux'), icon: "Server" });
}

const filteredCategories = computed(() => {
  const query = settingsSearch.value.trim().toLowerCase();
  if (!query) return categories;
  return categories.filter((category) => {
    const haystack = `${t(`settings.sections.${category.id}`)} ${category.id} ${categorySearchKeywords[category.id] || ''}`.toLowerCase();
    return query.split(/\s+/).every((word) => haystack.includes(word));
  });
});

watch(filteredCategories, (visible) => {
  if (settingsSearch.value && visible.length > 0 && !visible.some((item) => item.id === activeCategory.value)) {
    selectCategory(visible[0].id);
  }
});

// 图标映射（修复类型问题）
const icons: Record<string, FunctionalComponent> = {
  Settings,
  Clock,
  Bell,
  AlertTriangle,
  Laptop,
  Monitor,
  Server,
  LineChart,
  Save,
  HelpCircleIcon,
  SlidersHorizontal,
  RotateCcw,
  Wrench,
  Undo2,
};

// 初始化本地配置对象
const localConfig = reactive<any>({
  // 基本配置默认值
  toggle_key: "ALT",
  search_shortcut: "",
  backend: "Auto",
  auto_restart: true,
  language: "zh-CN",

  // 通知配置默认值
  enable_notifications: true,
  show_icon: true,
  notification_icon: "",
  notification_sound: "",

  // 粘贴行为默认值
  prefer_clipboard: false,
  clipboard_threshold: 50,
  paste_shortcut: "",
  fast_inject: false,
  pre_paste_delay: 0,
  post_paste_delay: 0,

  // macOS 特定配置
  mac_use_applescript_backend: false,
  mac_use_events_backend: false,
  mac_experimental_accessibility: false,
  
  // Windows 特定配置
  win_use_legacy_inject: false,
  win_use_send_input_backend: false,
  
  // Linux 特定配置
  x11_use_xdotool_backend: false,
  x11_use_xsel_backend: false,
  x11_use_evdev_backend: false,
  x11_key_delay: 0,
  wayland_use_ydotool_backend: false,
  wayland_use_wtype_backend: false,
  wayland_paste_method: "clipboard",

  // 其他默认值
  inject_delay: 0,
  abort_key: "ESC",
  
  // 应用过滤
  filter_class: "",
  filter_title: "",
  
  // 路径配置
  config_path: "",
  packages_path: "",

  // 日志默认值
  verbose: false,
  log_level: "info",
  log_file: "",
  log_filter: ""
});

// 状态
const activeCategory = ref("basic");
const selectCategory = (categoryId: string) => {
  activeCategory.value = categoryId;
  const nextQuery = { ...route.query, section: categoryId };
  router.replace({ query: nextQuery }).catch(() => undefined);
};
watch(() => route.query.section, (section) => {
  if (section === 'applications') {
    router.replace('/apps').catch(() => undefined);
    return;
  }
  if (typeof section === 'string' && categories.some((category) => category.id === section)) {
    activeCategory.value = section;
  }
});
const originalConfig = ref<any>(null);
const isSaving = ref(false);
const loadError = ref<string | null>(null);
const isConfigLoaded = ref(false);

// 计算属性
const hasChanges = computed(() => {
  return !isEqual(localConfig, originalConfig.value);
});

// 获取分类名称
const getCategoryName = (categoryId: string) => {
  return t(`settings.sections.${categoryId}`);
};

// 钩子函数和调试
onMounted(() => {
  const requestedSection = typeof route.query.section === 'string' ? route.query.section : '';
  if (requestedSection === 'applications') {
    router.replace('/apps').catch(() => undefined);
    return;
  }
  if (requestedSection && categories.some((category) => category.id === requestedSection)) {
    activeCategory.value = requestedSection;
  }
  console.log('SettingsView 已挂载');
  console.log(`[SettingsView] 初始语言: ${locale.value}, 可用语言: ${availableLocales.join(', ')}`);
  console.log(`[SettingsView] localStorage中的语言设置: ${localStorage.getItem('espanso-language')}`);
  loadConfig();
});

// 错误捕获
onErrorCaptured((err, instance, info) => {
  console.error('SettingsView 捕获到错误:', err);
  loadError.value = `加载设置出错: ${err.message || String(err)}`;
  return false; // 阻止错误继续传播
});

// 修改loadConfig函数
const loadConfig = async () => {
  try {
    isConfigLoaded.value = false;
    loadError.value = null;
    console.log('开始加载全局配置');
    
    if (!store.state.globalConfig) {
      console.log('全局配置不可用，使用默认值');
      
      // 尝试从localStorage读取语言设置
      try {
        const storedLanguage = localStorage.getItem('espanso-language');
        if (storedLanguage && availableLocales.includes(storedLanguage)) {
          localConfig.language = storedLanguage;
          locale.value = storedLanguage;
          console.log(`[SettingsView] 从localStorage加载语言设置: ${storedLanguage}`);
        }
      } catch (e) {
        console.warn('[SettingsView] 读取localStorage语言设置失败:', e);
      }
      
      originalConfig.value = cloneDeep(localConfig);
      isConfigLoaded.value = true;
      return;
    }
    
    const config = store.state.globalConfig;
    if (config) {
      Object.assign(localConfig, config);
      
      // 优先级：
      // 1. 配置文件中的language值
      // 2. localStorage中的language值
      // 3. 当前locale值
      
      // 先检查配置文件中是否有language设置
      let languageSet = false;
      if (config.language) {
        locale.value = config.language;
        localConfig.language = config.language;
        languageSet = true;
        console.log(`[SettingsView] 从配置文件加载语言设置: ${config.language}`);
      }
      
      // 如果配置文件中没有language设置，尝试从localStorage读取
      if (!languageSet) {
        try {
          const storedLanguage = localStorage.getItem('espanso-language');
          if (storedLanguage && availableLocales.includes(storedLanguage)) {
            localConfig.language = storedLanguage;
            locale.value = storedLanguage;
            languageSet = true;
            console.log(`[SettingsView] 从localStorage加载语言设置: ${storedLanguage}`);
          }
        } catch (e) {
          console.warn('[SettingsView] 读取localStorage语言设置失败:', e);
        }
      }
      
      // 如果都没有设置，使用当前locale
      if (!languageSet) {
        localConfig.language = locale.value;
        console.log(`[SettingsView] 使用当前locale作为语言设置: ${locale.value}`);
      }
      
      console.log('全局配置加载成功:', localConfig);
      originalConfig.value = cloneDeep(localConfig);
    }
    
    isConfigLoaded.value = true;
  } catch (error: any) {
    console.error('加载全局配置失败:', error);
    loadError.value = `无法加载配置: ${error.message || String(error)}`;
  }
};

// 重试加载
const tryReload = () => {
  loadError.value = null;
  // 先尝试重新初始化store
  store
    .initializeStore()
    .then(() => {
      // 初始化完成后加载配置
      loadConfig();
    })
    .catch((err) => {
      loadError.value = `初始化失败: ${err.message || "未知错误"}`;
    });
};

// 保存前做最小但严格的类型与范围校验，避免数字输入被写成字符串或负值。
const validateSettings = () => {
  const nonNegativeFields = [
    ['clipboard_threshold', localConfig.clipboard_threshold],
    ['pre_paste_delay', localConfig.pre_paste_delay],
    ['post_paste_delay', localConfig.post_paste_delay],
    ['x11_key_delay', localConfig.x11_key_delay],
    ['inject_delay', localConfig.inject_delay],
  ] as const;

  for (const [key, value] of nonNegativeFields) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      throw new Error(`${key} 必须是大于或等于 0 的数字`);
    }
    localConfig[key] = numericValue;
  }
};

// 保存设置
const saveSettings = async () => {
  try {
    isSaving.value = true;
    validateSettings();
    console.log('开始保存设置:', localConfig);
    
    // 使用store的正确方法保存全局配置
    await store.updateGlobalConfig(localConfig);
    
    // 保存时应用语言设置
    if (localConfig.language && localConfig.language !== locale.value) {
      // 先更新localStorage中的语言设置，确保下次加载时能正确读取
      localStorage.setItem('espanso-language', localConfig.language);
      console.log(`[SettingsView] 语言设置已保存到localStorage: ${localConfig.language}`);
      
      // 然后更新当前的locale值
      locale.value = localConfig.language;
    }
    
    // 更新原始配置，重置修改状态
    originalConfig.value = cloneDeep(localConfig);
    console.log('设置保存成功');
    toast.success(t('settings.settingsSaved'));

    // 重新加载配置以确保所有更改都已正确应用
    await loadConfig();
  } catch (error: any) {
    console.error('保存设置失败:', error);
    
    // 显示更详细的错误信息
    let errorMessage = error.message || String(error);
    if (error.cause) {
      errorMessage += `\n原因: ${error.cause}`;
    }
    
    // 如果是初始化错误，提供更具体的提示
    if (errorMessage.includes('初始化全局配置失败')) {
      toast.error(t('settings.initializationFailed', { error: errorMessage }));
    } else {
      toast.error(t('settings.settingsSaveFailed', { error: errorMessage }));
    }
    
    // 如果保存失败，可能需要重新加载原始配置
    await loadConfig();
  } finally {
    isSaving.value = false;
  }
};

// 重置为默认值
const resetToDefault = () => {
  if (originalConfig.value) {
    Object.assign(localConfig, cloneDeep(originalConfig.value));
    toast.info(t('settings.restoredToLastSave'));
  }
};

// 将主题状态同步到本地的 ref，以便 Select 组件可以双向绑定
// 注意：这里我们不直接将 appTheme (来自 useTheme) 用于 v-model
// 因为 appTheme 的更改是立即应用到 <html> 标签的
// 我们希望用户的选择在 Select 中先被选中，但不立即应用，直到他们点击"保存"
// 然而，对于主题切换，通常期望选择后立即生效，而不是等待保存按钮
// 所以，这里我们直接使用 appTheme，并在选择时调用 setAppTheme
// 为了简单起见，我们让主题选择立即生效。如果需要"保存后生效"，逻辑会更复杂。

const selectedAppTheme = ref(appTheme.value); // 初始化 selectedAppTheme
watch(appTheme, (newTheme) => { // 当通过其他方式改变主题时（例如系统切换），更新下拉框
  selectedAppTheme.value = newTheme;
});
watch(selectedAppTheme, (newThemeChoice) => { // 当用户在下拉框中选择时，更新主题
  if (newThemeChoice) {
    setAppTheme(newThemeChoice);
  }
});
</script>

<style scoped>
.settings-view {
  height: 100%;
  width: 100%;
  overflow: auto;
  @apply bg-background text-foreground; /* 应用基础主题 */
}

.content-view, .loading-view, .error-view {
  height: 100%; 
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
  /* background-color: white; */ /* 改为使用 card 或 background */
  @apply bg-card; /* 或根据需要使用 bg-background */
}

.loading-view, .error-view {
  height: 70vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  @apply bg-card text-foreground; /* 确保背景和文本颜色正确 */
}

.settings-container {
  display: flex;
  gap: 2rem;
}

.settings-sidebar {
  width: 220px;
  flex-shrink: 0;
  /* border-right: 1px solid #e0e0e0; */
  @apply border-r border-border; /* 使用主题边框色 */
  padding-right: 1rem;
  align-self: flex-start;
  position: sticky;
  top: 0.5rem;
  max-height: calc(100vh - 8rem);
  overflow-y: auto;
}

.settings-content {
  flex: 1;
}

.category-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  justify-content: flex-start;
  text-align: left;
  background: transparent;
  @apply text-muted-foreground; /* 默认文字颜色 */
}

.category-item:hover {
  /* background-color: #f5f5f5; */
  @apply bg-accent text-accent-foreground; /* 使用主题悬停色 */
}

.category-item.active {
  /* background-color: #e0e0ff; */
  /* color: #4a4ae8; */
  @apply bg-primary/10 text-primary font-medium; /* 使用主题激活色 */
}

.spinner {
  width: 40px;
  height: 40px;
  /* border: 4px solid rgba(0, 0, 0, 0.1); */
  border: 4px solid;
  @apply border-border rounded-full;
  /* border-top-color: #3182ce; */
  @apply border-t-primary animate-spin;
}

.alert-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  /* color: #e53935; */
  @apply text-destructive; /* 使用主题危险色 */
}

.error-message {
  margin-bottom: 1.5rem;
  /* color: #e53935; */
  @apply text-destructive; /* 使用主题危险色 */
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.accent-presets {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.5rem;
}

.accent-preset {
  min-height: 42px;
  gap: 0.45rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  color: hsl(var(--muted-foreground));
}

.accent-preset:hover,
.accent-preset.active {
  border-color: hsl(var(--primary) / 0.65);
  color: hsl(var(--foreground));
  background: hsl(var(--primary) / 0.08);
}

.accent-preset.active {
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.16);
}

.accent-swatch {
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.3);
  flex: 0 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 加载动画 */
.loader {
  width: 1rem;
  height: 1rem;
  border: 2px solid;
  /* border: 2px solid rgba(255, 255, 255, 0.3); */ /* 改为使用变量 */
  @apply border-primary-foreground/30; /* 假设在主按钮上 */
  border-radius: 50%;
  /* border-top-color: white; */
  @apply border-t-primary-foreground; /* 假设在主按钮上 */
  animation: spin 1s linear infinite;
}


.settings-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.settings-search {
  width: min(520px, 100%);
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.6rem;
  background: hsl(var(--background));
}

.search-clear {
  width: 28px;
  height: 28px;
  border-radius: 9999px;
  color: hsl(var(--muted-foreground));
}
.search-clear:hover { background: hsl(var(--muted)); color: hsl(var(--foreground)); }

.preference-backup-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  background: hsl(var(--muted) / 0.18);
}

@media (max-width: 980px) {
  .settings-toolbar { align-items: flex-start; flex-direction: column; }
  .preference-backup-card { align-items: flex-start; flex-direction: column; }

  .settings-container {
    flex-direction: column;
    gap: 1rem;
  }

  .settings-sidebar {
    width: 100%;
    position: static;
    max-height: none;
    overflow-y: visible;
    border-right: 0;
    border-bottom: 1px solid hsl(var(--border));
    padding-right: 0;
    padding-bottom: 0.75rem;
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
  }

  .category-item {
    white-space: nowrap;
    margin-bottom: 0;
  }
}

@media (max-width: 760px) {
  .accent-presets {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .settings-content :deep(.grid-cols-2) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.sidebar-order-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 48px;
  padding: 10px;
  border: 1px dashed hsl(var(--border));
  border-radius: 10px;
  background: hsl(var(--muted) / 0.22);
}
.sidebar-order-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
  user-select: none;
}
.sidebar-order-handle {
  cursor: grab;
  color: hsl(var(--muted-foreground));
}
.sidebar-order-handle:active { cursor: grabbing; }
</style>
