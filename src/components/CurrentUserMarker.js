import React, { useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { Box, Avatar, Text, VStack } from '@chakra-ui/react';
import L from 'leaflet';

const CurrentUserMarker = ({ position, user }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Icône personnalisée pour l'utilisateur actuel
  const currentUserIcon = new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div style="
      background-color: #3182CE;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      justify-content: center;
      align-items: center;
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  return (
    <Marker 
      position={position} 
      icon={currentUserIcon}
      eventHandlers={{
        click: () => setIsOpen(true),
      }}
      zIndexOffset={1000} // S'assurer que ce marqueur est au-dessus des autres
    >
      <Popup onClose={() => setIsOpen(false)}>
        <Box p={1} maxW="200px">
          <VStack spacing={2} align="center">
            <Avatar 
              size="md" 
              name={user.name || 'Moi'} 
              src={user.avatarUrl}
              bg="blue.500"
            />
            <Text fontWeight="bold">
              {user.name || 'Moi'} (Vous)
            </Text>
            <Text fontSize="sm" color="gray.600">
              {user.status || 'En ligne'}
            </Text>
          </VStack>
        </Box>
      </Popup>
    </Marker>
  );
};

export default CurrentUserMarker;

