import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Image, ScrollView, TextInput, Alert, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, getDocs, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from './firebase';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome } from '@expo/vector-icons';
import styles, { colors } from './styles';

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

  const formatDate = (input) => {
    if (!input) return "";
    try { if (input.toDate && typeof input.toDate === 'function') return new Date(input.toDate()).toLocaleDateString(); } catch(e){}
    if (input instanceof Date) return input.toLocaleDateString();
    try { const d = new Date(input); if (!isNaN(d.getTime())) return d.toLocaleDateString(); } catch(e){}
    return "";
  };

  const formatDateTime = (input) => {
    if (!input) return "";
    try { if (input.toDate && typeof input.toDate === 'function') return new Date(input.toDate()).toLocaleString(); } catch(e){}
    if (input instanceof Date) return input.toLocaleString();
    try { const d = new Date(input); if (!isNaN(d.getTime())) return d.toLocaleString(); } catch(e){}
    return "";
  };

  const formatDateShort = (input) => {
    if (!input) return "";
    try { if (input.toDate && typeof input.toDate === 'function') return new Date(input.toDate()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch(e){}
    if (input instanceof Date) return input.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    try { const d = new Date(input); if (!isNaN(d.getTime())) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch(e){}
    return "";
  };

  

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
        <ActivityIndicator size="large" color={colors.viridian} />
        <Text style={{marginTop:8, color: colors.textDark}}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
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
        <ScrollView style={{padding:12, backgroundColor: colors.azureWeb}}>
          {selectedQuest && (
            <>
              {selectedQuest.image ? <Image source={{uri:selectedQuest.image}} style={{width:'100%',height:220,borderRadius:8,marginBottom:12}} /> : null}
              <View style={{flexDirection:'row', alignItems:'center', marginTop:0}}>
                <View style={{width:40,height:40,borderRadius:20,backgroundColor: colors.viridian,alignItems:'center',justifyContent:'center',marginRight:12}}>
                  <FontAwesome name={CLASS_ICONS[selectedQuest.class] || 'map-o'} size={18} color="#fff" />
                </View>
                <Text style={{fontSize:22,fontWeight:'800', color: colors.textDark, flexShrink:1}}>{selectedQuest.title}</Text>
              </View>
              {(selectedQuest.startDate || selectedQuest.endDate) ? (
                <Text style={{marginTop:6, color: colors.textMuted}}>
                  {selectedQuest.startDate && selectedQuest.endDate
                    ? `${formatDateShort(selectedQuest.startDate)} — ${formatDateShort(selectedQuest.endDate)}`
                    : (selectedQuest.startDate ? `Starts ${formatDateShort(selectedQuest.startDate)}` : `Ends ${formatDateShort(selectedQuest.endDate)}`)}
                </Text>
              ) : null}
              {selectedQuest.location ? <Text style={{marginTop:6, color: colors.viridian}}>{selectedQuest.location}</Text> : null}
              <Text style={{marginTop:6}}>{selectedQuest.description}</Text>

              {/* Available rewards row */}
              <View style={{flexDirection:'row', alignItems:'center', marginTop:12}}>
                <Text style={{fontWeight:'700', color: colors.textDark, marginRight:12}}>Available rewards</Text>
                <View style={{flexDirection:'row', alignItems:'center'}}>
                  <View style={{flexDirection:'row', alignItems:'center', marginRight:16}}>
                    <FontAwesome name='bolt' size={16} color={colors.viridian} />
                    <Text style={{marginLeft:8, color: colors.textMuted}}>{selectedQuest.rewards?.xp || 0} XP</Text>
                  </View>
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                    <FontAwesome name='trophy' size={16} color={colors.viridian} />
                    <Text style={{marginLeft:8, color: colors.textMuted}}>{selectedQuest.rewards?.badge || 'None'}</Text>
                  </View>
                </View>
              </View>
              <View style={{flexDirection:'row', alignItems:'center', marginTop:8}}>
                {selectedQuest.user?.icon ? <Image source={{uri:selectedQuest.user.icon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
                <Text>{selectedQuest.user?.name}</Text>
              </View>

              <View style={styles.separator} />
              <Text style={{marginTop:0,fontSize:18,fontWeight:'bold'}}>Posts</Text>
              <View style={styles.postsSection}>
                {selectedQuest.posts?.length ? selectedQuest.posts.map((p,i)=>(
                  <View key={i} style={styles.postCard}>
                    <View style={{flexDirection:'row', alignItems:'center', marginBottom:6}}>
                      {p.userIcon ? <Image source={{uri:p.userIcon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
                      <Text style={{fontWeight:'600'}}>{p.username}</Text>
                    </View>
                    <Text style={{color:'#333', marginBottom:6}}>{p.description}</Text>
                    {p.image && <Image source={{uri:p.image}} style={styles.postImagePreview} />}
                    {p.timeRange || p.createdAt || p.date ? (
                      <View style={{flexDirection:'row', alignItems:'center', marginTop:8}}>
                        <FontAwesome name='clock-o' size={14} color={colors.textMuted} />
                        <Text style={{marginLeft:8, color: colors.textMuted}}>
                          {p.timeRange
                            ? (typeof p.timeRange === 'string'
                                ? formatDateShort(p.timeRange)
                                : (p.timeRange.start && p.timeRange.end
                                    ? `${formatDateShort(p.timeRange.start)} — ${formatDateShort(p.timeRange.end)}`
                                    : (p.timeRange.start ? formatDateShort(p.timeRange.start) : (p.timeRange.end ? formatDateShort(p.timeRange.end) : ''))))
                            : (p.createdAt ? formatDateShort(p.createdAt) : (p.date ? formatDateShort(p.date) : ''))
                          }
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )) : <Text style={{color:'#666'}}>No posts yet. Be the first to share!</Text>}
              </View>

              {/* Composer Box */}
              <View style={styles.composerBox}>
                <TextInput placeholder="Write a post... (max 50 words)" style={[styles.input,{flex:1, marginBottom:0, backgroundColor: colors.mintCream}]} value={newPostDesc} onChangeText={setNewPostDesc} multiline />
                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:8}}>
                  <TouchableOpacity style={styles.buttonSmall} onPress={()=>pickImage(setNewPostImage)}>
                    <Text style={styles.buttonText}>Add Image</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:'#A4C3B2'}]} onPress={()=>handleAddPost(selectedQuest)}>
                    <Text style={styles.buttonText}>Post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:'#CCE3DE'}]} onPress={()=>{ setNewPostDesc(''); setNewPostImage(null); }}>
                    <Text style={styles.buttonText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                {newPostImage ? <Image source={{uri:newPostImage}} style={styles.postImagePreview} /> : null}
              </View>

              <View style={{marginTop:8}}>
                <TouchableOpacity style={[styles.button,{backgroundColor:'#6B9080'}]} onPress={()=>handleCompleteQuest(selectedQuest)}>
                  <Text style={styles.buttonText}>Complete Quest</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.button,{backgroundColor:'#CCE3DE'}]} onPress={()=>setModalVisible(false)}>
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
