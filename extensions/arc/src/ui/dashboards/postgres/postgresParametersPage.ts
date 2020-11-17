/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { PostgresModel } from '../../../models/postgresModel';

export class PostgresParametersPage extends DashboardPage {
	private searchBox?: azdata.InputBoxComponent;

	private discardButton?: azdata.ButtonComponent;
	private saveButton?: azdata.ButtonComponent;
	private resetButton?: azdata.ButtonComponent;


	private readonly _azdataApi: azdataExt.IExtension;

	constructor(protected modelView: azdata.ModelView, private _postgresModel: PostgresModel) {
		super(modelView);
		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

		this.initializeSearchBox();

		this.disposables.push(this._postgresModel.onConfigUpdated(
			() => this.eventuallyRunOnInitialized(() => this.handleServiceUpdated())));
	}

	protected get title(): string {
		return loc.nodeParameters;
	}

	protected get id(): string {
		return 'postgres-node-parameters';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.nodeParameters;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.nodeParameters,
			CSSStyles: { ...cssStyles.title }
		}).component());

		const info = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.nodeParametersDescription,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const link = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: loc.learnAboutNodeParameters,
			url: 'https://docs.microsoft.com/azure/azure-arc/data/configure-server-parameters-postgresql-hyperscale',
		}).component();

		const infoAndLink = this.modelView.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();
		infoAndLink.addItem(info, { CSSStyles: { 'margin-right': '5px' } });
		infoAndLink.addItem(link);
		content.addItem(infoAndLink, { CSSStyles: { 'margin-bottom': '25px' } });

		content.addItem(this.searchBox!, { CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' } });
		// Add in content

		const parametersTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			width: '100%',
			columns: [
				{
					displayName: 'Parameter Name',
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: 'Value',
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: false,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: {
						...cssStyles.tableRow,
						'overflow': 'hidden',
						'text-overflow': 'ellipsis',
						'white-space': 'nowrap',
						'max-width': '0'
					}
				},
				{
					displayName: 'Description',
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: '50%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: {
						...cssStyles.tableRow,
						'overflow': 'hidden',
						'text-overflow': 'ellipsis',
						'white-space': 'nowrap',
						'max-width': '0'
					}
				},
				{
					displayName: 'Reset To Default',
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: false,
					width: '10%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: [
				this.parameterComponents('TEST NAME', 'string'),
				this.parameterComponents('TEST NAME 2', 'real')]
		}).component();

		content.addItem(parametersTable);


		this.initialized = true;

		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// Save Edits
		this.saveButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.saveText,
			iconPath: IconPathHelper.save,
			enabled: false
		}).component();

		this.disposables.push(
			this.saveButton.onDidClick(async () => {
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.updatingInstance(this._postgresModel.info.name),
							cancellable: false
						},
						(_progress, _token) => {
							return this._azdataApi.azdata.arc.postgres.server.edit(
								this._postgresModel.info.name, {});		// TODO
						}
					);

					//Edit multiple
					// azdata arc postgres server edit -n <server group name> -e '<parameter name>="<parameter value>"", <parameter name>="<parameter value>"",...'



					this._postgresModel.refresh();

					vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));

				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._postgresModel.info.name, error));
				}
			}));

		// Discard
		this.discardButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.discardText,
			iconPath: IconPathHelper.discard,
			enabled: false
		}).component();

		this.disposables.push(
			this.discardButton.onDidClick(async () => {
				this.discardButton!.enabled = false;
				try {
					// TODO
				} catch (error) {
					vscode.window.showErrorMessage(loc.pageDiscardFailed(error));
				} finally {
					this.saveButton!.enabled = false;
				}
			}));

		// Reset
		this.resetButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.resetToDefault,
			iconPath: IconPathHelper.reset,
			CSSStyles: { 'transform': 'scaleX(-1)' },
			enabled: true
		}).component();

		this.disposables.push(
			this.resetButton.onDidClick(async () => {
				this.resetButton!.enabled = false;
				this.discardButton!.enabled = false;
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.updatingInstance(this._postgresModel.info.name),
							cancellable: false
						},
						async (_progress, _token): Promise<void> => {
							try {
								await this._azdataApi.azdata.arc.postgres.server.edit(
									this._postgresModel.info.name, { engineSettings: `'' -rf` });
							} catch (err) {
								// If an error occurs while resetting the instance then re-enable the reset button since
								// the edit wasn't successfully applied
								this.resetButton!.enabled = true;
								throw err;
							}
							await this._postgresModel.refresh();
						}

					);

					// TODO
					//all
					// azdata arc postgres server edit -n <server group name> -e '' -re
					//indv
					// azdata arc postgres server edit -n postgres01 -e shared_buffers=

				} catch (error) {
					vscode.window.showErrorMessage(loc.refreshFailed(error));
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: this.saveButton },
			{ component: this.discardButton },
			{ component: this.resetButton }
		]).component();
	}

	private initializeSearchBox() {
		this.searchBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			placeHolder: loc.searchToFilter
		}).component();

		this.disposables.push(
			this.searchBox.onTextChanged(() => {
				this.filterParameters();
			})
		);
	}

	private filterParameters() {

	}

	private createParametersTable() {
		// Define server settings that shouldn't be modified. we block archive_*, restore_*, and synchronous_commit to prevent the user
		// from messing up our backups. (we rely on synchronous_commit to ensure WAL changes are written immediately.)
		// we block log_* to protect our logging. we block wal_level because Citus needs a particular wal_Level to rebalance shards
		// TODO: Review list of blacklisted parameters. wal_level should only be blacklisted if sharding is enabled
		/* To not be modified
			"archive_command", "archive_timeout", "log_directory", "log_file_mode", "log_filename", "restore_command",
			"shared_preload_libraries", "synchronous_commit", "ssl", "unix_socket_permissions", "wal_level" */


	}

	private parameterComponents(name: string, type: string): any[] {

		let data = [];
		const parameterName = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: name,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();
		data.push(parameterName);

		let valueBox;
		let information;
		if (type === 'enum') {
			valueBox = this.modelView.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
				values: [], //TODO
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component();

			information = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				iconPath: IconPathHelper.information,
				title: loc.pgSettingOptions('enums'), //TODO
				width: '12px',
				height: '12px',
				enabled: false
			}).component();
		} else if (type === 'bool') {
			valueBox = this.modelView.modelBuilder.checkBox().withProperties<azdata.CheckBoxProperties>({
				label: 'On', //TODO
				checked: true, //TODO
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component();

			information = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				iconPath: IconPathHelper.information,
				title: loc.pgSettingOptions('on,off'), //TODO
				width: '12px',
				height: '12px',
				enabled: false
			}).component();
		} else if (type === 'string') {
			valueBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
				readOnly: false,
				value: '', //TODO
				CSSStyles: { 'margin-bottom': '15px', 'min-width': '50px', 'max-width': '200px' }
			}).component();

			information = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				iconPath: IconPathHelper.information,
				title: loc.pgSettingOptions('[A-Za-z._]+'),
				width: '12px',
				height: '12px',
				enabled: false
			}).component();
		} else {
			valueBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
				readOnly: false,
				min: 0, //TODO
				validationErrorMessage: '', //TODO
				inputType: 'number',
				value: '0', //TODO
				CSSStyles: { 'margin-bottom': '15px', 'min-width': '50px', 'max-width': '200px' }
			}).component();

			information = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				iconPath: IconPathHelper.information,
				title: loc.pgSettingRange('min', 'max'), //TODO
				width: '12px',
				height: '12px',
				enabled: false
			}).component();
		}

		const valueContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		valueContainer.addItem(valueBox, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px' } });
		valueContainer.addItem(information, { CSSStyles: { 'margin-left': '5px', 'margin-bottom': '15px' } });
		data.push(valueContainer);

		const parameterDescription = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'TEST DESCRIPTION HERE ...............................ytgbyugvtyvctyrcvytjv ycrtctyv tyfty ftyuvuyvuy',
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();
		data.push(parameterDescription);

		const resetParameter = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			iconPath: IconPathHelper.ellipse,
			title: 'Reset to default', //TODO
			width: '20px',
			height: '20px',
			enabled: true
		}).component();
		data.push(resetParameter);

		return data;

	}

	private getPGSettings(): any {
		// Get settings

		return {
			parameterName: 'name',
			value: 'settings',
			description: 'short_desc',
			default: 'reset_val',
			min: 'min_val',
			max: 'max_val',
			options: 'enumvals',
			type: 'vartype'
		};
	}




	private handleServiceUpdated() {
		// TODO
	}
}