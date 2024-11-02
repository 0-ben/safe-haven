import { Image, StyleSheet, Platform, Button, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { JSEncrypt } from 'jsencrypt'
import * as SecureStore from 'expo-secure-store';
import * as MediaLibrary from 'expo-media-library';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

function splitByBytes(str: string, byteSize: number) {
    let chunks = [];
    let currentChunk = "";
    let currentSize = 0;

    for (let char of str) {
        const charSize = new Blob([char]).size;

        if (currentSize + charSize > byteSize) {
            chunks.push(currentChunk);
            currentChunk = char;
            currentSize = charSize;
        } else {
            currentChunk += char;
            currentSize += charSize;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}


const hash = (input: string, algorithm: Crypto.CryptoDigestAlgorithm = Crypto.CryptoDigestAlgorithm.SHA256): Promise<string> => {
    return Crypto.digestStringAsync(
        algorithm,
        input,
        // default encoding is hex.
    );
}

async function ChooseFilesToImport() {
    const publicKey = await SecureStore.getItemAsync("public-rsa-key")
    if (!publicKey) {
        Alert.alert("No public key found!", "Set up a key pair first, in the settings tab, before importing any files.")
        return;
    }
    
    const directory = await SecureStore.getItemAsync("storage-directory")
    if (!directory) {
        Alert.alert("No directory selected!", "Choose a directory in the settings tab, before importing any files.")
        return;
    }
    
    const docs = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
    }).catch(console.warn)
    
    if (!docs || docs.canceled) return;
    for (const asset of docs.assets) {
        const newFilename = `${await hash(asset.name, Crypto.CryptoDigestAlgorithm.SHA1)}-${new Date().toISOString().split('T')[0]}-${await hash(asset.uri, Crypto.CryptoDigestAlgorithm.SHA1)}-${Crypto.randomUUID()}_${asset.name.split('.').at(-1)}.shef` // Safe Haven Encrypted File
        // const newPath = directory + '/' + newFilename
        // const tempPath = directory + '/' + newFilename
        
        const content = await FileSystem.readAsStringAsync(asset.uri)
        const dataContent = `data:${asset.mimeType};base64,` + content
        

        const crypt = new JSEncrypt()
        crypt.setPublicKey(publicKey)

        let encryptedContent = `v2${crypt.encrypt(asset.name)}\n`
        const sections = splitByBytes(dataContent, 96) // 1024 bit keys can support max of 128 bytes, and 839 bit keys have been broken. 1024 bit is a bare minimum. For some reason, 128 bit did not work, but 96 did
        for (const section of sections) {
            console.log(section.length)
            const encrypted = crypt.encrypt(section) 
            encryptedContent += encrypted + '|'
        }

        // const encryptedContent = crypt.encrypt(dataContent)
        // if (!encryptedContent) {
        //     console.error(`Failed to encrypt into ${newFilename}`)
        // }
        // console.log(`Writing ${encryptedContent.substring(0, 100)} to ${tempPath}`)
        // Solved via https://github.com/expo/expo/issues/12060 
        const newFile = await FileSystem.StorageAccessFramework.createFileAsync(
            directory,
            newFilename,
            "application/octet-stream"
        );
        await FileSystem.writeAsStringAsync(newFile, encryptedContent, { encoding: FileSystem.EncodingType.UTF8 });
        // await FileSystem.writeAsStringAsync(newPath, encryptedContent as string).catch(console.error)
        // await MediaLibrary.saveToLibraryAsync(tempPath).catch((e) => {
        //     console.error(`${tempPath} - ${e}`)
        // })
    }
}

export default function ImportScreen() {
    const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
    if (permissionResponse?.status != 'granted') requestPermission()
    
    return (
        <ParallaxScrollView
            headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
            headerImage={<></>}
        >
            <ThemedView style={styles.titleContainer}>
                <ThemedText type="title">Add files</ThemedText>
            </ThemedView>
            <ThemedView style={styles.stepContainer}>
                {/* <ThemedText type="subtitle">Step 1: Try it</ThemedText> */}
                <Button
                    onPress={ChooseFilesToImport}
                    title="Select File(s)"
                    color="#9659FF"
                    accessibilityLabel="Choose files to import."
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
