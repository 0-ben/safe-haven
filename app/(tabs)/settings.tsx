
import { Image, StyleSheet, Platform, Button, Alert, View, TextInput } from 'react-native';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

import React, { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
// import RSANative, { RSA } from 'react-native-rsa-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

function PromptForKeyPairCreation(): Promise<string> {
    return new Promise(resolve => {
        Alert.alert("No keys initialised", "Do you want to import a key pair now?", [
            {
                text: 'No',
                onPress: () => undefined,
                style: 'cancel',
            },
            {
                text: 'Yes', 
                onPress: async () => {
                    // console.log(RSA)
                    // console.log(RSANative)
                    // const keys = await RSA.generateKeys(4096)
                    // console.log(`Saving public key ${keys.public}`)
                    // await SecureStore.setItemAsync("public-rsa-key", keys.public)
                    // resolve(keys.public)
                    // console.log('hiiiiii')
                    // const crypt = new JSEncrypt({ default_key_size: '4096' })
                    // console.log(crypt)
                    // console.log(crypt.getPublicKey())
                    // console.log(crypt.getPrivateKey())
                    // resolve(crypt.getPublicKey())
                    const doc = await DocumentPicker.getDocumentAsync({
                        copyToCacheDirectory: true,
                        multiple: true,
                        type: 'application/x-pem-file'
                    })
                    // console.log(doc)
                    let publicFoundPromiseResolve ;
                    const publicFoundPromise = new Promise<string>(resolve => publicFoundPromiseResolve = resolve);
                    if (doc.assets == null || doc.canceled || doc.assets.length != 2) return console.log('Cancelled/invalid document.', doc.assets == null, doc.canceled, doc.assets?.length != 2);
                    for (const asset of doc.assets) {
                        const content = await FileSystem.readAsStringAsync(asset.uri)
                        console.log(content.substring(0, 50))
                        if (content.startsWith('-----BEGIN RSA PRIVATE KEY-----')) {
                            await Sharing.shareAsync(asset.uri, {
                                dialogTitle: 'Save private key',
                                mimeType: asset.mimeType,
                            })
                        } else if (content.startsWith('-----BEGIN PUBLIC KEY-----')) {
                            console.log(`Saving public key`)
                            await SecureStore.setItemAsync("public-rsa-key", content)
                            publicFoundPromiseResolve!(content)
                        }
                        await FileSystem.deleteAsync(asset.uri)
                    }

                    
                    resolve(await publicFoundPromise)
                    
                    // console.log(content.substring(0, 100))
                }
            },
        ])
    })
}

function PromptForDirectorySelection(): Promise<string | null> {
    return new Promise<string | null>(async resolve => {
        const permissions: { granted: boolean; directoryUri: string } = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync() as any;
        if (!permissions.granted || !permissions.directoryUri) resolve(null);
        await SecureStore.setItemAsync("storage-directory", permissions.directoryUri)

        resolve(permissions.directoryUri)
    })
}

export default function SettingsScreen() {
    const [isReady, setReady] = useState(false)
    const [hasPreInitialisedKeys, setHasPreInitialisedKeys] = useState(false);
    const [publicKey, setPublicKey] = useState('')
    // const [keyLength, setKeyLength] = useState('')
    const [storageDirectory, setStorageDirectory] = useState<string | null>(null)



    useEffect(() => {
        SecureStore.getItemAsync("public-rsa-key").then(gotPublicKey => {
            if (!gotPublicKey) {
                setHasPreInitialisedKeys(false)
                PromptForKeyPairCreation().then(pub => {
                    console.log(pub, gotPublicKey)
                    setPublicKey(pub)
                    setHasPreInitialisedKeys(true)
                    setReady(true)
                })
            } else {
                setHasPreInitialisedKeys(true)
                setPublicKey(gotPublicKey)
                setReady(true)
            }
        })
        SecureStore.getItemAsync("storage-directory").then(gotStorageDirectory => {
            if (gotStorageDirectory) 
                setStorageDirectory(gotStorageDirectory)
        })
    }, []);
    // useEffect(() => {
    //     SecureStore.getItemAsync("public-rsa-key-length").then(gotKeyLength => {
    //         if (gotKeyLength) 
    //             setKeyLength(gotKeyLength)
    //     })
    // }, [publicKey])

    return (
        <ParallaxScrollView headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }} headerImage={<></>}>
            <ThemedView style={styles.titleContainer}>
                <ThemedText type="title">Settings</ThemedText>
            </ThemedView>
            <ThemedView style={styles.stepContainer}>
                {isReady ? 
                <>
                    {hasPreInitialisedKeys ?
                    <>
                        <ThemedText
                            style={{
                                fontSize: 20
                            }}
                        >Public Key</ThemedText>
                        <TextInput
                            multiline={true}
                            style={{
                                height: 120,
                                margin: 12,
                                borderWidth: 1,
                                padding: 10,
                                fontSize: 12
                            }}
                            editable={false}
                            scrollEnabled={true}
                            value={publicKey}
                            placeholder="placeholder. if you see this something went very wrong."
                            keyboardType="numeric"
                        />
                        

                    </>
                    :
                    <>
                        <Button
                            // onPress={(event) => {
                            //     Alert.prompt("title", "message", (text) => {
                            //         Alert.alert("text entered", text)
                            //     })
                            // }}
                            onPress={PromptForKeyPairCreation}
                            title="Import Key Pair"
                            color="#279129"
                            accessibilityLabel="Import the RSA public & private key."
                        />
                    </>}
                    <ThemedText
                        style={{
                            fontSize: 20
                        }}
                    >File Storage Directory</ThemedText>
                    <Button
                        // onPress={(event) => {
                        //     Alert.prompt("title", "message", (text) => {
                        //         Alert.alert("text entered", text)
                        //     })
                        // }}
                        onPress={() => {
                            PromptForDirectorySelection().then(dir => {
                                if (!dir) return;
                                setStorageDirectory(dir)
                            })
                        }}
                        title={storageDirectory ?? "No directory specified"}
                        color="#888888"
                        accessibilityLabel="Import the RSA public & private key."
                    />
                </>
                    

                : 
                <>
                    <ThemedText>Loading settings...</ThemedText>
                </>
                }
            </ThemedView>

            
        </ParallaxScrollView>
    );
}

const styles = StyleSheet.create({
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    stepContainer: {
        gap: 8,
        marginBottom: 8,
    },
    reactLogo: {
        height: 178,
        width: 290,
        bottom: 0,
        left: 0,
        position: 'absolute',
    },
});
