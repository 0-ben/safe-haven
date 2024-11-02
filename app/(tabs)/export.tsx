import React, { useState } from "react";
import { Image, StyleSheet, Platform, Button, Alert } from 'react-native';
import Dialog from "react-native-dialog";
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';


import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import JSEncrypt from "jsencrypt";

export default function HomeScreen() {

    return (
        <ParallaxScrollView headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }} headerImage={<></>}>
        <ThemedView style={styles.stepContainer}>
            {/* <ThemedText type="subtitle">Step 1: Try it</ThemedText> */}
            
            <Button
                onPress={async () => {
                    const directory = await SecureStore.getItemAsync("storage-directory")
                    if (!directory) {
                        Alert.alert("No directory selected!", "Choose a directory in the settings tab, before exporting any files.")
                        return;
                    }
                        
                    const doc = await DocumentPicker.getDocumentAsync({
                        copyToCacheDirectory: true,
                        multiple: false
                    }).catch(console.warn)
                    // console.log(doc)
                    if (!doc || doc.assets == null || doc.assets.length != 1 || doc.canceled) return console.log('Cancelled private key selection.');
                    const asset = doc.assets[0]
                    const content = await FileSystem.readAsStringAsync(asset.uri)
                    // console.log(content.substring(0, 100))
                    if (!content.startsWith('-----BEGIN RSA PRIVATE KEY-----')) return Alert.alert("Invalid private key!", 
                        content.startsWith('-----BEGIN PUBLIC KEY-----') ? 'Provided file is a public key, not a private key.' : 'Provided file is an invalid RSA key of any type.')

                    const crypt = new JSEncrypt()
                    crypt.setPrivateKey(content)

                    let files = await FileSystem.StorageAccessFramework.readDirectoryAsync(directory);
                    const shefFiles = files.filter(x => x.endsWith('.shef'))
                    
                    const permissions: { granted: boolean; directoryUri: string } = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync() as any;
                    if (!permissions.granted || !permissions.directoryUri) return console.log('Not given folder to export to');
                    
                    const exportDir = permissions.directoryUri;
                    let i = 0;
                    for (const fn of shefFiles) {
                        
                        const inFilename = fn.split('/').at(-1)?.split('.')[0]!
                        let outFilename = inFilename.split('_').join('.') // TODO: encrypt original filename to restore, too

                        const content = await FileSystem.readAsStringAsync(fn)
                        let body = content
                        if (content.startsWith('v2')) {
                            const [ metadata, _body] = content.slice(2).split('\n')
                            body = _body
                            const decryptedMetadata = crypt.decrypt(metadata)
                            if (!decryptedMetadata) {
                                console.warn('Cannot decrypt file.')
                                continue;
                            }
                            outFilename = decryptedMetadata 
                        }
                        
                        const sections = body.split('|')
                        let decrypted = ''
                        for (const section of sections) {
                            if (section.trim() == '') continue;
                            const desect = crypt.decrypt(section)
                            if (!desect) console.warn('Failed to decrypt section.')
                            decrypted += desect
                        }
                        const newFile = await FileSystem.StorageAccessFramework.createFileAsync(
                            exportDir,
                            outFilename,
                            "application/octet-stream"
                        );
                        await FileSystem.writeAsStringAsync(newFile, decrypted, { encoding: FileSystem.EncodingType.UTF8 });
                        console.log(`Finished writing ${newFile} (${++i}/${shefFiles.length})`)

                    }
                }}
                title="Choose Private Key"
                color="#841584"
                accessibilityLabel="Provide private key"
            />
            
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
