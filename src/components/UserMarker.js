import React, { useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { Box, Avatar, Text, VStack, Button } from '@chakra-ui/react';
import L from 'leaflet';

const UserMarker = ({ position, user, onClick, isSelected }) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // Icône personnalisée pour les autres utilisateurs
  const userIcon = new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div style="
      background-color: ${isSelected ? '#ED8936' : '#38A169'};
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      justify-content: center;
      align-items: center;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const handleStartChat = () => {
    onClick(user);
    setIsPopupOpen(false);
  };

  return (
    <Marker 
      position={position} 
      icon={userIcon}
      eventHandlers={{
        click: () => setIsPopupOpen(true),
      }}
    >
      <Popup onClose={() => setIsPopupOpen(false)}>
        <Box p={1} maxW="200px">
          <VStack spacing={2} align="center">
            <Avatar 
              size="md" 
              name={user.name || 'Utilisateur'} 
              src={user.avatarUrl}
              bg="green.500"
            />
            <Text fontWeight="bold">
              {user.name || 'Utilisateur'}
            </Text>
            <Text fontSize="sm" color="gray.600">
              {user.status || 'En ligne'}
            </Text>
            <Button 
              colorScheme="blue" 
              size="sm" 
              onClick={handleStartChat}
            >
              Discuter
            </Button>
          </VStack>
        </Box>
      </Popup>
    </Marker>
  );
};

export default UserMarker;

