import { useEffect, useState } from 'react';
import { getCurrentUser, loginWithGoogle } from '../lib/appwrite';
import { Button, Box, Text, Center, Spinner, VStack, Image } from '@chakra-ui/react';
import { FcGoogle } from 'react-icons/fc';

const AuthGuard = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'utilisateur:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Erreur lors de la connexion avec Google:', error);
    }
  };

  if (loading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (!user) {
    return (
      <Center h="100vh" bg="gray.50">
        <VStack spacing={8} p={8} boxShadow="lg" borderRadius="md" bg="white" w="sm">
          <Image src="/logo.png" alt="Logo" h="100px" />
          <Text fontSize="2xl" fontWeight="bold">Bienvenue sur MapChat</Text>
          <Text textAlign="center">Connectez-vous pour voir les utilisateurs sur la carte et discuter avec eux</Text>
          <Button
            leftIcon={<FcGoogle />}
            onClick={handleGoogleLogin}
            size="lg"
            w="full"
            colorScheme="blue"
            variant="outline"
          >
            Se connecter avec Google
          </Button>
        </VStack>
      </Center>
    );
  }

  return children;
};

export default AuthGuard;

