import React, { useEffect, useState } from 'react';
import { Account, Client, Databases, Storage, Query, ID } from 'appwrite';
import { FaCamera, FaUserCircle, FaVideo, FaImage, FaFilePdf, FaSignOutAlt, FaGoogle, FaTrash } from 'react-icons/fa';

const ProfilePage = () => {
  // Initialize Appwrite client
  const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('67bb24ad002378e79e38');

  const account = new Account(client);
  const databases = new Databases(client);
  const storage = new Storage(client);

  const DATABASE_ID = '67bb32ca00157be0d0a2';
  const COLLECTION_ID = '67ec0ff5002cafd109d7';
  const BUCKET_ID = '67c698210004ee988ef1';

  const [user, setUser] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [textContent, setTextContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [follows, setFollows] = useState({});
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      // Check if user is already logged in
      checkSession();
    }
  }, []);

  const checkSession = async () => {
    try {
      const session = await account.get();
      if (session) {
        setUser(session);
        localStorage.setItem('user', JSON.stringify(session));
      }
    } catch (error) {
      console.log('User is not logged in');
    }
  };

  useEffect(() => {
    if (user) {
      const fetchPhotos = async () => {
        try {
          const userData = await databases.getDocument(
            DATABASE_ID,
            'users', // Assuming you have a users collection
            user.$id
          );
          setProfilePhotoUrl(userData.profilePhotoUrl || '');
          setCoverPhotoUrl(userData.coverPhotoUrl || '');
        } catch (error) {
          console.error('Error fetching user photos:', error);
        }
      };
      fetchPhotos();
      fetchUploads();
    }
  }, [user]);

  const fetchUploads = async () => {
    if (!user) return;

    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_ID,
        [
          Query.equal('userId', user.$id)
        ]
      );
      setUploads(response.documents);
    } catch (error) {
      console.error('Error fetching uploads:', error);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          'users' // Assuming you have a users collection
        );
        const usersData = response.documents.filter(u => u.$id !== user?.$id);
        setUsers(usersData);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    if (user) {
      fetchUsers();
    }
  }, [user]);

  useEffect(() => {
    const fetchEngagements = async () => {
      if (!user) return;
      
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          'engagements', // Assuming you have an engagements collection
          [
            Query.equal('userId', user.$id),
            Query.equal('type', 'follow')
          ]
        );

        const followsData = {};
        response.documents.forEach(doc => {
          followsData[doc.followedUserId] = true;
        });
        
        setFollows(followsData);
      } catch (error) {
        console.error('Error fetching engagements:', error);
      }
    };

    if (user) {
      fetchEngagements();
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      // Redirect to Google OAuth
      account.createOAuth2Session('google', 
        window.location.href, // Success URL
        window.location.href // Failure URL
      );
    } catch (error) {
      console.error("Erreur d'authentification: ", error);
    }
  };

  const handleLogout = async () => {
    try {
      await account.deleteSessions();
      setUser(null);
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleUpload = async () => {
    if (!file && !imageFile && !pdfFile && !textContent) return;

    const urls = {};

    try {
      if (file) {
        const fileUpload = await storage.createFile(
          BUCKET_ID,
          ID.unique(),
          file
        );
        const fileUrl = storage.getFileView(BUCKET_ID, fileUpload.$id);
        urls.videoUrl = fileUrl.href;
      }

      if (imageFile) {
        const imageUpload = await storage.createFile(
          BUCKET_ID,
          ID.unique(),
          imageFile
        );
        const imageUrl = storage.getFileView(BUCKET_ID, imageUpload.$id);
        urls.imageUrl = imageUrl.href;
      }

      if (pdfFile) {
        const pdfUpload = await storage.createFile(
          BUCKET_ID,
          ID.unique(),
          pdfFile
        );
        const pdfUrl = storage.getFileView(BUCKET_ID, pdfUpload.$id);
        urls.pdfUrl = pdfUrl.href;
      }

      const newUpload = await databases.createDocument(
        DATABASE_ID,
        COLLECTION_ID,
        ID.unique(),
        {
          title,
          description,
          videoUrl: urls.videoUrl || '',
          imageUrl: urls.imageUrl || '',
          pdfUrl: urls.pdfUrl || '',
          textContent,
          userId: user.$id,
          createdAt: new Date().toISOString(),
        }
      );

      setTitle('');
      setDescription('');
      setFile(null);
      setImageFile(null);
      setPdfFile(null);
      setTextContent('');

      // Refresh uploads
      fetchUploads();
    } catch (error) {
      console.error('Error uploading content:', error);
    }
  };

  const handlePhotoUpload = async (photo, type) => {
    if (!photo) return;
    
    try {
      const fileUpload = await storage.createFile(
        BUCKET_ID,
        ID.unique(),
        photo
      );
      
      const photoUrl = storage.getFileView(BUCKET_ID, fileUpload.$id).href;
      
      if (type === 'profile') {
        setProfilePhotoUrl(photoUrl);
        await databases.updateDocument(
          DATABASE_ID,
          'users',
          user.$id,
          { profilePhotoUrl: photoUrl }
        );
      } else if (type === 'cover') {
        setCoverPhotoUrl(photoUrl);
        await databases.updateDocument(
          DATABASE_ID,
          'users',
          user.$id,
          { coverPhotoUrl: photoUrl }
        );
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        COLLECTION_ID,
        id
      );
      // Refresh uploads
      fetchUploads();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const toggleFollow = async (followedUserId) => {
    try {
      const engagementId = `${followedUserId}_${user.$id}_follow`;
      
      if (follows[followedUserId]) {
        // Unfollow
        await databases.deleteDocument(
          DATABASE_ID,
          'engagements',
          engagementId
        );
        setFollows(prev => ({ ...prev, [followedUserId]: false }));
      } else {
        // Follow
        await databases.createDocument(
          DATABASE_ID,
          'engagements',
          engagementId,
          {
            followedUserId,
            userId: user.$id,
            type: 'follow'
          }
        );
        setFollows(prev => ({ ...prev, [followedUserId]: true }));
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      {/* Nav Bar */}
      <nav className="flex justify-between items-center p-4 bg-gray-800 text-white shadow-md">
        <h1 className="text-xl font-bold">
          {user ? user.name || 'Profile Page' : 'Profile Page'}
        </h1>
        {user ? (
          <button onClick={handleLogout} className="bg-red-500 flex items-center gap-2 px-4 py-2 rounded">
            <FaSignOutAlt /> Logout
          </button>
        ) : (
          <button onClick={handleLogin} className="bg-green-500 flex items-center gap-2 px-4 py-2 rounded">
            <FaGoogle /> Login with Google
          </button>
        )}
      </nav>

      {/* Profile & Cover Photo */}
      <div className="relative mt-4">
        <div className="relative">
          {coverPhotoUrl ? (
            <img
              src={coverPhotoUrl}
              alt="Cover"
              className="w-full h-48 object-cover rounded-lg shadow-md"
            />
          ) : (
            <div className="w-full h-48 bg-gray-200 rounded-lg shadow-md"></div>
          )}
          {user && (
            <label className="absolute top-2 right-2 cursor-pointer">
              <FaCamera className="text-white bg-black rounded-full p-1" />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e.target.files[0], 'cover')}
                className="hidden"
              />
            </label>
          )}
        </div>
        <div className="relative">
          {profilePhotoUrl ? (
            <img
              src={profilePhotoUrl}
              alt="Profile"
              className="w-32 h-32 rounded-full border-4 border-white absolute top-[-4rem] left-4 shadow-lg"
            />
          ) : (
            <FaUserCircle className="w-32 h-32 rounded-full border-4 border-white absolute top-[-4rem] left-4 shadow-lg text-gray-400" />
          )}
          {user && (
            <label className="absolute top-0 left-24 cursor-pointer">
              <FaCamera className="text-white bg-black rounded-full p-1" />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e.target.files[0], 'profile')}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Upload Section */}
      {user && (
        <div className="mt-8 flex flex-col items-center">
          <div className="w-full max-w-3xl bg-white shadow-lg rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Upload Content</h2>
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border p-2 w-full mb-2 rounded"
            />
            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border p-2 w-full mb-2 rounded"
            />
            <textarea
              placeholder="Write your text here..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="border p-2 w-full mb-2 rounded"
              rows="4"
            ></textarea>

            <div className="flex justify-between items-center my-4">
              <label className="cursor-pointer flex items-center gap-2">
                <FaVideo className="text-blue-500" />
                <input
                  type="file"
                  accept="video/*,audio/*"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="hidden"
                />
                <span>Upload Video/Audio</span>
              </label>

              <label className="cursor-pointer flex items-center gap-2">
                <FaImage className="text-green-500" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files[0])}
                  className="hidden"
                />
                <span>Upload Image</span>
              </label>

              <label className="cursor-pointer flex items-center gap-2">
                <FaFilePdf className="text-red-500" />
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files[0])}
                  className="hidden"
                />
                <span>Upload PDF</span>
              </label>
            </div>

            <button
              onClick={handleUpload}
              className="bg-blue-500 text-white px-4 py-2 rounded shadow-md w-full"
            >
              Upload
            </button>
          </div>
        </div>
      )}

      {/* Uploads Section */}
      {user && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-4">Your Uploads</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {uploads.map((upload) => (
              <div key={upload.$id} className="bg-white shadow-lg rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  {profilePhotoUrl ? (
                    <img
                      src={profilePhotoUrl}
                      alt={user.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <FaUserCircle className="w-8 h-8 text-gray-400" />
                  )}
                  <h3 className="font-bold">{upload.title}</h3>
                </div>
                <p>{upload.description}</p>
                {upload.videoUrl && (
                  <video controls src={upload.videoUrl} className="w-full mt-2 rounded-lg" />
                )}
                {upload.imageUrl && (
                  <img src={upload.imageUrl} alt="Uploaded" className="w-full mt-2 rounded-lg" />
                )}
                {upload.pdfUrl && (
                  <a
                    href={upload.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 mt-2 inline-block"
                  >
                    <FaFilePdf /> View PDF
                  </a>
                )}
                <p className="mt-2">{upload.textContent}</p>

                <div className="flex justify-end items-center mt-4">
                  <button
                    onClick={() => handleDelete(upload.$id)}
                    className="bg-red-500 text-white flex items-center gap-2 px-4 py-2 rounded shadow"
                  >
                    <FaTrash /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Section */}
      {user && (
        <div className="mt-8">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border p-2 w-full mb-4 rounded"
          />
          <h2 className="text-lg font-bold mb-4">Users</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto">
            {users
              .filter((u) => u.name?.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((user) => (
                <div key={user.$id} className="bg-white shadow-lg rounded-lg p-4 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {user.profilePhotoUrl ? (
                      <img
                        src={user.profilePhotoUrl}
                        alt={user.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <FaUserCircle className="w-8 h-8 text-gray-400" />
                    )}
                    <span>{user.name}</span>
                  </div>
                  <button
                    onClick={() => toggleFollow(user.$id)}
                    className={`px-4 py-2 rounded shadow ${
                      follows[user.$id] ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'
                    }`}
                  >
                    {follows[user.$id] ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;

