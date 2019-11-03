/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import * as azdata from 'azdata';
import { ProviderConnectionInfo } from 'sql/platform/connection/common/providerConnectionInfo';
import { equalsIgnoreCase } from 'vs/base/common/strings';
import { generateUuid } from 'vs/base/common/uuid';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { isString } from 'vs/base/common/types';
import { ConnectionOptionSpecialType } from 'sql/workbench/api/common/sqlExtHostTypes';
import * as Constants from 'sql/platform/connection/common/constants';
import { ConnectionShape } from 'sql/platform/connection/common/connectionShape';

// Concrete implementation of the IConnectionProfile interface

/**
 * A concrete implementation of an IConnectionProfile with support for profile creation and validation
 */
export class ConnectionProfile extends ProviderConnectionInfo {

	public parent?: ConnectionProfileGroup;
	private _id: string;
	public savePassword: boolean;
	private _groupName?: string;
	public groupId: string;
	public saveProfile: boolean;

	public isDisconnecting: boolean = false;

	public constructor(
		capabilitiesService: ICapabilitiesService,
		model: string | azdata.IConnectionProfile) {
		super(capabilitiesService, model);
		if (model && !isString(model)) {
			this.groupId = model.groupId;
			this.groupFullName = model.groupFullName;
			this.savePassword = model.savePassword;
			this.saveProfile = model.saveProfile;
			this._id = model.id;
			this.azureTenantId = model.azureTenantId;
			if (this.capabilitiesService && model.providerName) {
				let capabilities = this.capabilitiesService.getCapabilities(model.providerName);
				if (capabilities && capabilities.connection && capabilities.connection.connectionOptions) {
					const options = capabilities.connection.connectionOptions;
					let appNameOption = options.find(option => option.specialValueType === ConnectionOptionSpecialType.appName);
					if (appNameOption) {
						let appNameKey = appNameOption.name;
						this.options[appNameKey] = Constants.applicationName;
					}
				}
				if (model.options.registeredServerDescription) {
					this.registeredServerDescription = model.options.registeredServerDescription;
				}
			}
		} else {
			//Default for a new connection
			this.savePassword = false;
			this.saveProfile = true;
			this._groupName = ConnectionProfile.RootGroupName;
			this._id = generateUuid();
		}

		this.options['groupId'] = this.groupId;
		this.options['databaseDisplayName'] = this.databaseName;
	}

	public matches(shape: ConnectionShape): boolean {
		return shape
			&& this.providerName === shape.providerName
			&& this.nullCheckEqualsIgnoreCase(this.serverName, shape.serverName)
			&& this.nullCheckEqualsIgnoreCase(this.databaseName, shape.databaseName)
			&& this.nullCheckEqualsIgnoreCase(this.userName, shape.userName)
			&& this.nullCheckEqualsIgnoreCase(this.options['databaseDisplayName'], shape.options['databaseDisplayName'])
			&& this.authenticationType === shape.authenticationType
			&& this.groupId === shape.groupId;
	}

	private nullCheckEqualsIgnoreCase(a: string, b: string) {
		let bothNull: boolean = !a && !b;
		return bothNull ? bothNull : equalsIgnoreCase(a, b);
	}

	public generateNewId() {
		this._id = generateUuid();
	}

	public getParent(): ConnectionProfileGroup | undefined {
		return this.parent;
	}

	public get id(): string {
		if (!this._id) {
			this._id = generateUuid();
		}
		return this._id;
	}

	public set id(value: string) {
		this._id = value;
	}

	public get azureTenantId(): string | undefined {
		return this.options['azureTenantId'];
	}

	public set azureTenantId(value: string | undefined) {
		this.options['azureTenantId'] = value;
	}

	public get registeredServerDescription(): string {
		return this.options['registeredServerDescription'];
	}

	public set registeredServerDescription(value: string) {
		this.options['registeredServerDescription'] = value;
	}

	public get groupFullName(): string | undefined {
		return this._groupName;
	}

	public set groupFullName(value: string | undefined) {
		this._groupName = value;
	}

	public get isAddedToRootGroup(): boolean {
		return (this._groupName === ConnectionProfile.RootGroupName);
	}

	public clone(): ConnectionProfile {
		let instance = new ConnectionProfile(this.capabilitiesService, this);
		return instance;
	}

	public cloneWithNewId(): ConnectionProfile {
		let instance = this.clone();
		instance.generateNewId();
		return instance;
	}

	public cloneWithDatabase(databaseName: string): ConnectionProfile {
		let instance = this.cloneWithNewId();
		instance.databaseName = databaseName;
		return instance;
	}

	public static readonly RootGroupName: string = '/';

	public withoutPassword(): ConnectionProfile {
		let clone = this.clone();
		clone.password = '';
		return clone;
	}

	/**
	 * Returns a key derived the connections options (providerName, authenticationType, serverName, databaseName, userName, groupid)
	 * This key uniquely identifies a connection in a group
	 * Example: "providerName:MSSQL|authenticationType:|databaseName:database|serverName:server3|userName:user|group:testid"
	 */
	public getOptionsKey(): string {
		let id = super.getOptionsKey();
		let databaseDisplayName: string = this.options['databaseDisplayName'];
		if (databaseDisplayName) {
			id += ProviderConnectionInfo.idSeparator + 'databaseDisplayName' + ProviderConnectionInfo.nameValueSeparator + databaseDisplayName;
		}

		return id + ProviderConnectionInfo.idSeparator + 'group' + ProviderConnectionInfo.nameValueSeparator + this.groupId;
	}

	/**
	 * Returns the unique id for the connection that doesn't include the group name
	 */
	public getConnectionInfoId(): string {
		return super.getOptionsKey();
	}

	public toConnectionInfo(): azdata.ConnectionInfo {
		return {
			options: this.options
		};
	}

	/**
	 * Returns whether this profile is connected to the default database (it doesn't specify a database to connect to)
	 */
	public static isConnectionToDefaultDb(profile: azdata.IConnectionProfile): boolean {
		return !profile.databaseName || profile.databaseName.trim() === '';
	}

	public static fromIConnectionProfile(capabilitiesService: ICapabilitiesService, profile: azdata.IConnectionProfile): ConnectionProfile {
		if (profile instanceof ConnectionProfile) {
			return profile;
		} else {
			return new ConnectionProfile(capabilitiesService, profile);
		}
	}
}
