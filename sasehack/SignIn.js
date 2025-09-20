// import React, { useState } from "react";
// import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from "react-native";
// import * as ImagePicker from "expo-image-picker";
// import { auth, db, storage } from "./firebase";
// import { signInWithEmailAndPassword } from "firebase/auth";
// import { doc, setDoc } from "firebase/firestore";
// import { ref, uploadBytes, getDownloadURL, uploadString } from "firebase/storage";
// import * as FileSystem from "expo-file-system";
// import { signOut } from "firebase/auth";


// export default function SignIn({ navigation }) {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");

//   const handleSignIn = async () => {
//     if (!email || !password) {
//       Alert.alert("Error", "Please fill all fields");
//       return;
//     }

//     try {
//       const userCredential = await signInWithEmailAndPassword(auth, email, password);
//       const user = userCredential.user;

//       // Navigate to Questboard, passing the userId
//       navigation.replace("Questboard", { userId: user.uid });
//     } catch (error) {
//       Alert.alert("Error", error.message);
//     }
//   };
  

//   return (
//     <View style={styles.container}>
//       <Text style={styles.header}>Sign In</Text>

//       <TextInput
//         placeholder="Email"
//         style={styles.input}
//         value={email}
//         onChangeText={setEmail}
//         keyboardType="email-address"
//         autoCapitalize="none"
//       />
//       <TextInput
//         placeholder="Password"
//         style={styles.input}
//         value={password}
//         onChangeText={setPassword}
//         secureTextEntry
//       />

//       <TouchableOpacity style={styles.button} onPress={handleSignIn}>
//         <Text style={styles.buttonText}>Sign In</Text>
//       </TouchableOpacity>

//       <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
//         <Text style={{ color: "blue", textAlign: "center", marginTop: 10 }}>
//           I don’t have an account
//         </Text>
//       </TouchableOpacity>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, padding: 20, justifyContent: "center", backgroundColor: "#f7f1e3" },
//   header: { fontSize: 28, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
//   input: { backgroundColor: "#fff", padding: 12, borderRadius: 8, marginBottom: 12 },
//   button: { backgroundColor: "#6c5ce7", padding: 15, borderRadius: 8 },
//   buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
// });

