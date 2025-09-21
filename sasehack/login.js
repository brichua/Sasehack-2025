import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import styles, { colors } from './styles';

export default function Login({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert("Error", "Fill all fields");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      navigation.replace("MainTabs");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.safeArea}>
      <View style={{flex:1, justifyContent:'center'}}>
        <Text style={{fontSize:26, fontWeight:'800', textAlign:'center', color: colors.textDark, marginBottom:18}}>Welcome Back</Text>

        <TextInput placeholder="Email" style={styles.input2} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput placeholder="Password" style={styles.input2} value={password} onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity style={[styles.button,{backgroundColor: colors.viridian}]} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
          <Text style={{ color: colors.cambridgeBlue, marginTop: 10, textAlign: "center" }}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

