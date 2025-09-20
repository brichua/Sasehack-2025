import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Image, ScrollView, TextInput, Alert, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, getDocs, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from './firebase';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome } from '@expo/vector-icons';

const CLASS_ICONS = {
  Explorer: 'map',
  Baker: 'cutlery',
  Artist: 'paint-brush'
};

export default function MapScreen() {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState(null);
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPostDesc, setNewPostDesc] = useState("");
  const [newPostImage, setNewPostImage] = useState(null);

  useEffect(() => {
    (async () => {
      // try to get user location to center map
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          setRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 });
        }
      } catch (e) {
        // ignore permission errors; we'll center on first quest if available
        console.warn('Location error', e);
      }

      await fetchQuests();
    })();
  }, []);

  const fetchQuests = async () => {
    try {
      const snap = await getDocs(collection(db, 'Quests'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const withCoords = list.filter(q => q.placeCoords && q.placeCoords.lat && q.placeCoords.lng);
      setQuests(withCoords);
      if (!region && withCoords.length > 0) {
        const first = withCoords[0];
        setRegion({ latitude: first.placeCoords.lat, longitude: first.placeCoords.lng, latitudeDelta: 0.1, longitudeDelta: 0.1 });
      }
    } catch (e) {
      console.warn('fetchQuests map', e);
    } finally {
      setLoading(false);
    }
  };

  const openQuest = async (quest) => {
    // optionally refresh quest data from Firestore
    try {
      const qdoc = await getDoc(doc(db, 'Quests', quest.id));
      if (qdoc.exists()) setSelectedQuest({ id: qdoc.id, ...qdoc.data() });
      else setSelectedQuest(quest);
    } catch (e) {
      setSelectedQuest(quest);
    }
    setModalVisible(true);
  };

  const pickImage = async (setter) => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing:true, aspect:[1,1], quality:0.5 });
      if (!result.canceled) setter(result.assets[0].uri);
    } catch (e) {
      console.warn('image picker error', e);
    }
  };

  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString() : "";

  const handleAddPost = async (quest) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');

      let imageUrl = null;
      if (newPostImage) imageUrl = newPostImage;

      // try to get user's avatar and displayName from Users doc
      let userIcon = "";
      let username = user.displayName || "";
      try {
        const udoc = await getDoc(doc(db, "Users", user.uid));
        if (udoc.exists()) userIcon = udoc.data().avatarUrl || userIcon;
        if (udoc.exists()) username = udoc.data().displayName || username;
      } catch (e) { /* ignore */ }

      const questRef = doc(db, "Quests", quest.id);
      await updateDoc(questRef, { posts: arrayUnion({ username, userIcon, description: newPostDesc, image: imageUrl, userId: user.uid }) });

      setNewPostDesc("");
      setNewPostImage(null);
      const qdoc = await getDoc(questRef);
      if (qdoc.exists()) setSelectedQuest({ id: qdoc.id, ...qdoc.data() });
      await fetchQuests();
    } catch (e) { Alert.alert('Error adding post', e.message); }
  };

  const handleCompleteQuest = async (quest) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');

      const userRef = doc(db, "Users", user.uid);
      const udoc = await getDoc(userRef);
      const userData = udoc.exists() ? udoc.data() : {};

      const currentXp = Array.isArray(userData.xp) ? userData.xp.reduce((a,b)=>a+(Number(b)||0),0) : (Number(userData.xp) || 0);
      const rewardXp = quest?.rewards?.xp ? Number(quest.rewards.xp) : 0;
      const newXpTotal = currentXp + rewardXp;
      const newLevel = Math.floor(newXpTotal / 100);

      const updates = {};
      updates.xp = newXpTotal;
      updates.level = newLevel;

      if (quest.class) {
        const currentClassMap = (userData.class && typeof userData.class === 'object' && !Array.isArray(userData.class)) ? { ...userData.class } : {};
        const cls = quest.class;
        currentClassMap[cls] = (Number(currentClassMap[cls]) || 0) + 1;
        updates.class = currentClassMap;
      }

      if (quest.rewards && quest.rewards.badge) {
        const badgeTitle = quest.rewards.badge;
        const badgesField = userData.badges || {};
        let badgeObj = null;
        if (Array.isArray(badgesField)) {
          const found = badgesField.find(b => b.title === badgeTitle);
          if (found) badgeObj = { ...found };
        } else if (badgesField && typeof badgesField === 'object') {
          if (badgesField[badgeTitle]) badgeObj = { ...(badgesField[badgeTitle]) };
          else if (badgesField.title === badgeTitle) badgeObj = { ...badgesField };
        }
        if (!badgeObj) badgeObj = { title: badgeTitle, progress: 0, tier: 0 };
        badgeObj.progress = (Number(badgeObj.progress) || 0) + 1;
        const p = badgeObj.progress;
        let tier = 0;
        if (p >= 100) tier = 4;
        else if (p >= 50) tier = 3;
        else if (p >= 25) tier = 2;
        else if (p >= 5) tier = 1;
        badgeObj.tier = tier;
        const newBadgesMap = (badgesField && typeof badgesField === 'object' && !Array.isArray(badgesField)) ? { ...badgesField } : {};
        newBadgesMap[badgeTitle] = badgeObj;
        updates.badges = newBadgesMap;
      }

      await updateDoc(userRef, { ...updates, quests: arrayUnion(quest.id) });

      Alert.alert('Quest Completed!', `+${rewardXp} XP — Level ${newLevel}`);
      setModalVisible(false);
      await fetchQuests();
    } catch (e) { Alert.alert('Error', e.message); }
  };

  if (loading || !region) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6c5ce7" />
        <Text style={{marginTop:8}}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={{flex:1}}>
      <MapView style={{flex:1}} initialRegion={region} showsUserLocation>
        {quests.map(q => (
          <Marker
            key={q.id}
            coordinate={{ latitude: q.placeCoords.lat, longitude: q.placeCoords.lng }}
            onPress={() => openQuest(q)}
          >
            <View style={styles.pin}>
              <FontAwesome name={CLASS_ICONS[q.class] || 'map-o'} size={18} color="#fff" />
            </View>
          </Marker>
        ))}
      </MapView>

      <Modal visible={modalVisible} animationType="slide">
        <ScrollView style={{padding:12}}>
          {selectedQuest && (
            <>
              {selectedQuest.image ? <Image source={{uri:selectedQuest.image}} style={{width:'100%',height:220,borderRadius:8,marginBottom:12}} /> : null}
              <Text style={{fontSize:24,fontWeight:'bold'}}>{selectedQuest.title}</Text>
              <Text style={{marginTop:6}}>{selectedQuest.description}</Text>
              <Text style={{marginTop:6}}>Class: {selectedQuest.class}</Text>
              <Text>Difficulty: {selectedQuest.difficulty}</Text>
              {selectedQuest.location ? <Text style={{marginTop:6}}>Location: {selectedQuest.location}</Text> : null}
              {selectedQuest.placeCoords ? <Text>Coords: {selectedQuest.placeCoords.lat}, {selectedQuest.placeCoords.lng}</Text> : null}
              <View style={{flexDirection:'row', alignItems:'center', marginTop:8}}>
                {selectedQuest.user?.icon ? <Image source={{uri:selectedQuest.user.icon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
                <Text>{selectedQuest.user?.name}</Text>
              </View>
              <Text style={{marginTop:8}}>XP: {selectedQuest.rewards?.xp || 0} | Badge: {selectedQuest.rewards?.badge || 'None'}</Text>

              <Text style={{marginTop:20,fontSize:18,fontWeight:'bold'}}>Posts</Text>
              <View style={styles.postsSection}>
                {selectedQuest.posts?.length ? selectedQuest.posts.map((p,i)=>(
                  <View key={i} style={styles.postCard}>
                    <View style={{flexDirection:'row', alignItems:'center', marginBottom:6}}>
                      {p.userIcon ? <Image source={{uri:p.userIcon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
                      <Text style={{fontWeight:'600'}}>{p.username}</Text>
                    </View>
                    <Text style={{color:'#333', marginBottom:6}}>{p.description}</Text>
                    {p.image && <Image source={{uri:p.image}} style={styles.postImagePreview} />}
                  </View>
                )) : <Text style={{color:'#666'}}>No posts yet. Be the first to share!</Text>}
              </View>

              {/* Composer Box */}
              <View style={styles.composerBox}>
                <TextInput placeholder="Write a post... (max 50 words)" style={[styles.input,{flex:1, marginBottom:0, backgroundColor:'#fff'}]} value={newPostDesc} onChangeText={setNewPostDesc} multiline />
                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:8}}>
                  <TouchableOpacity style={styles.buttonSmall} onPress={()=>pickImage(setNewPostImage)}>
                    <Text style={styles.buttonText}>Add Image</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:'#00b894'}]} onPress={()=>handleAddPost(selectedQuest)}>
                    <Text style={styles.buttonText}>Post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:'#d63031'}]} onPress={()=>{ setNewPostDesc(''); setNewPostImage(null); }}>
                    <Text style={styles.buttonText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                {newPostImage ? <Image source={{uri:newPostImage}} style={styles.postImagePreview} /> : null}
              </View>

              <View style={{marginTop:8}}>
                <TouchableOpacity style={[styles.button,{backgroundColor:'#00b894'}]} onPress={()=>handleCompleteQuest(selectedQuest)}>
                  <Text style={styles.buttonText}>Complete Quest</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.button,{backgroundColor:'#d63031'}]} onPress={()=>setModalVisible(false)}>
                  <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {flex:1,justifyContent:'center',alignItems:'center'},
  pin: { backgroundColor:'#6c5ce7', padding:8, borderRadius:18, borderWidth:2, borderColor:'#fff', elevation:4 },
  closeButton: { padding:12, borderRadius:8, marginTop:12 }
  ,
  button: { padding:10, borderRadius:8, backgroundColor:"#6c5ce7", marginVertical:5 },
  buttonText: { color:"#fff", textAlign:"center", fontWeight:"bold" },
  postCard: { backgroundColor:'#fff', padding:10, borderRadius:8, marginVertical:6 },
  composerBox: { backgroundColor:'#f0f0f0', padding:10, borderRadius:8, marginVertical:10 },
  postsSection: { marginTop:8 },
  buttonSmall: { padding:8, borderRadius:8, backgroundColor:'#6c5ce7', minWidth:90, marginRight:6 },
  postImagePreview: { width:'100%', height:150, borderRadius:8, marginTop:8 }
});
