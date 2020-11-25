/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azurecore from 'azurecore';
import { azureResource } from 'azureResource';

async function getAzureCoreAPI(): Promise<azurecore.IExtension> {
	const api = (await vscode.extensions.getExtension(azurecore.extension.name)?.activate()) as azurecore.IExtension;
	if (!api) {
		throw new Error('azure core API undefined for sql-migration');
	}
	return api;
}

export type Subscription = azureResource.AzureResourceSubscription;
export async function getSubscriptions(account: azdata.Account): Promise<Subscription[]> {
	const api = await getAzureCoreAPI();
	const subscriptions = await api.getSubscriptions(account, false);
	let listOfSubscriptions = subscriptions.subscriptions;
	listOfSubscriptions.sort((a, b) => {
		if (a.name < b.name) {
			return -1;
		}
		if (a.name > b.name) {
			return 1;
		}
		return 0;
	});
	return subscriptions.subscriptions;
}

export type AzureProduct = azureResource.AzureGraphResource;

export type SqlManagedInstance = AzureProduct;
export async function getAvailableManagedInstanceProducts(account: azdata.Account, subscription: Subscription): Promise<SqlManagedInstance[]> {
	const api = await getAzureCoreAPI();

	const result = await api.runGraphQuery<SqlManagedInstance>(account, [subscription], false, `where type == "${azureResource.AzureResourceType.sqlManagedInstance}"`);
	return result.resources;
}

export type SqlServer = AzureProduct;
export async function getAvailableSqlServers(account: azdata.Account, subscription: Subscription): Promise<SqlServer[]> {
	const api = await getAzureCoreAPI();

	const result = await api.runGraphQuery<SqlServer>(account, [subscription], false, `where type == "${azureResource.AzureResourceType.sqlServer}"`);
	return result.resources;
}

export type SqlVMServer = AzureProduct;
export async function getAvailableSqlVMs(account: azdata.Account, subscription: Subscription): Promise<SqlVMServer[]> {
	const api = await getAzureCoreAPI();

	const result = await api.runGraphQuery<SqlVMServer>(account, [subscription], false, `where type == "${azureResource.AzureResourceType.virtualMachines}" and properties.storageProfile.imageReference.publisher == "microsoftsqlserver"`);
	return result.resources;
}

export type StorageAccount = AzureProduct;
export async function getAvailableStorageAccounts(account: azdata.Account, subscription: Subscription): Promise<StorageAccount[]> {
	const api = await getAzureCoreAPI();
	const result = await api.runGraphQuery<StorageAccount>(account, [subscription], false, `where type == "${azureResource.AzureResourceType.storageAccount}"`);
	return result.resources;
}

export type FileShares = AzureProduct;
export async function getFileShares(account: azdata.Account, subscription: Subscription, storageAccount: StorageAccount): Promise<FileShares[]> {
	const api = await getAzureCoreAPI();
	const url = `https://management.azure.com` +
		`/subscriptions/${subscription.id}` +
		`/resourceGroups/${storageAccount.resourceGroup}` +
		`/providers/Microsoft.Storage/storageAccounts/${storageAccount.name}` +
		`/fileServices/default/shares?api-version=2019-06-01`;
	return (await api.runGetRequest(account, subscription, false, url)).response.data.value;
}

export type BlobContainer = AzureProduct;
export async function getBlobContainers(account: azdata.Account, subscription: Subscription, storageAccount: StorageAccount): Promise<BlobContainer[]> {
	const api = await getAzureCoreAPI();
	const url = `https://management.azure.com` +
		`/subscriptions/${subscription.id}` +
		`/resourceGroups/${storageAccount.resourceGroup}` +
		`/providers/Microsoft.Storage/storageAccounts/${storageAccount.name}` +
		`/blobServices/default/containers?api-version=2019-06-01`;
	const response = (await api.runGetRequest(account, subscription, false, url)).response.data.value;
	return response;
}
