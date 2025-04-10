import { useState } from 'react';
import { Marker, InfoWindow } from '@react-google-maps/api';
import { Box, Avatar, Text, Button } from '@chakra-ui/react';
import { getProfileImageUrl } from '../lib/appwrite';

const UserMarker = ({ user, currentUserId, onClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const profileImageUrl = user.profileImageId 
    ? getProfileImageUrl(user.profileImageId)
    : null;
  
  const markerIcon = {
    url: profileImageUrl || 'https://via.placeholder.com/40',
    scaledSize: new window.google.maps.Size(40, 40),
    origin: new window.google.maps.Point(0, 0),
    anchor: new window.google.maps.Point(20, 20),
    borderRadius: '50%'
  };

  const handleToggleOpen = () => {
    setIsOpen(!isOpen);
  };

  const handleStartChat = () => {
    onClick(user);
    setIsOpen(false);
  };

  // Ne pas afficher de marqueur pour l'utilisateur courant
  if (user.userId === currentUserId) {
    return null;
  }

  return (
    <Marker
      position={{ lat: user.location?.latitude, lng: user.location?.longitude }}
      onClick={handleToggleOpen}
      icon={markerIcon}
    >
      {isOpen && (
        <InfoWindow onCloseClick={handleToggleOpen}>
          <Box p={2} textAlign="center">
            <Avatar size="md" src={profileImageUrl} name={user.name} mb={2} />
            <Text fontWeight="bold">{user.name}</Text>
            <Button 
              size="sm" 
              colorScheme="blue" 
              mt={2} 
              onClick={handleStartChat}
            >
              Discuter
            </Button>
          </Box>
        </InfoWindow>
      )}
    </Marker>
  );
};

export default UserMarker;

