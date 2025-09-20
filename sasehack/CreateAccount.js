import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { auth, db, storage } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, uploadString } from "firebase/storage";
import * as FileSystem from "expo-file-system";
import { Link } from "@react-navigation/native";


export default function CreateAccount({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setAvatar(result.assets[0].uri);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !displayName) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

    //   let avatarUrl = null;

     
      
    //   if (avatar) {
    //   await user.getIdToken(true); // ensure auth is ready
    //   console.log("Avatar URI:", avatar);

    //   const response = await fetch(avatar);
    //   const blob = await response.blob();
    //   console.log("Blob size:", blob.size);

    //   const storageRef = ref(storage, `avatars/${user.uid}.jpg`);

    //   try {
    //     await uploadBytes(storageRef, blob);
    //     avatarUrl = await getDownloadURL(storageRef);
    //   } catch (err) {
    //     console.error("Upload failed:", err);
    //     console.error("Server response:", err?.serverResponse);
    //     throw err;
    //   }
    // }
      const avatarUrl = avatar || null;


      await setDoc(doc(db, "users", user.uid), {
        displayName,
        email,
        avatarUrl,
        createdAt: new Date(),
      });

      Alert.alert("Success", "Account created!");
      navigation.replace("Questboard", { userId: user.uid }); // Navigate to Questboard
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Create Account</Text>

      <TouchableOpacity onPress={pickImage} style={styles.avatarPicker}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <Text style={{ textAlign: "center" }}>Pick an Avatar</Text>
        )}
      </TouchableOpacity>

      <TextInput placeholder="Display Name" style={styles.input} value={displayName} onChangeText={setDisplayName} />
      <TextInput placeholder="Email" style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput placeholder="Password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

      <TouchableOpacity style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
      <Text style={{ color: "blue", textAlign: "center", marginTop: 10 }}>
        I already have an account.
      </Text>
    </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", backgroundColor: "#f7f1e3" },
  header: { fontSize: 28, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  input: { backgroundColor: "#fff", padding: 12, borderRadius: 8, marginBottom: 12 },
  button: { backgroundColor: "#6c5ce7", padding: 15, borderRadius: 8 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
  avatarPicker: { backgroundColor: "#fff", padding: 10, borderRadius: 50, marginBottom: 12, alignSelf: "center", width: 100, height: 100, justifyContent: "center" },
  avatar: { width: 100, height: 100, borderRadius: 50 },
});
