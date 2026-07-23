leandrodisconzi@MacBook-Pro-de-Leandro olivia % rclone config                                                                   
Current remotes:

Name                 Type
====                 ====
gdrive               drive
olivia               drive

e) Edit existing remote
n) New remote
d) Delete remote
r) Rename remote
c) Copy remote
s) Set configuration password
q) Quit config
e/n/d/r/c/s/q> n

Enter name for new remote.
name> example

Option Storage.
Type of storage to configure.
Choose a number from below, or type in your own value.
 1 / 1Fichier
   \ (fichier)
 2 / Akamai NetStorage
   \ (netstorage)
 3 / Alias for an existing remote
   \ (alias)
 4 / Amazon S3 Compliant Storage Providers including AWS, Alibaba, ArvanCloud, BizflyCloud, Ceph, ChinaMobile, Cloudflare, Cubbit, DigitalOcean, Dreamhost, Exaba, Fastly, FileLu, FlashBlade, GCS, HCP, Hetzner, HuaweiOBS, IBMCOS, IDrive, ImpossibleCloud, Intercolo, IONOS, Leviia, Liara, Linode, LyveCloud, Magalu, Mega, Minio, Netease, Outscale, OVHcloud, Petabox, Qiniu, Rabata, RackCorp, Rclone, Scaleway, SeaweedFS, Selectel, Servercore, SpectraLogic, Storj, Synology, TencentCOS, US3, Wasabi, Zadara, Zata, Other
   \ (s3)
 5 / Backblaze B2
   \ (b2)
 6 / Better checksums for other remotes
   \ (hasher)
 7 / Box
   \ (box)
 8 / Cache a remote
   \ (cache)
 9 / Citrix Sharefile
   \ (sharefile)
10 / Cloudinary
   \ (cloudinary)
11 / Combine several remotes into one
   \ (combine)
12 / Compress a remote
   \ (compress)
13 / DOI datasets
   \ (doi)
14 / Drime
   \ (drime)
15 / Dropbox
   \ (dropbox)
16 / Encrypt/Decrypt a remote
   \ (crypt)
17 / Enterprise File Fabric
   \ (filefabric)
18 / FTP
   \ (ftp)
19 / FileLu Cloud Storage
   \ (filelu)
20 / Filen
   \ (filen)
21 / Files.com
   \ (filescom)
22 / Gofile
   \ (gofile)
23 / Google Cloud Storage (this is not Google Drive)
   \ (google cloud storage)
24 / Google Drive
   \ (drive)
25 / Google Photos
   \ (google photos)
26 / HTTP
   \ (http)
27 / Hadoop distributed file system
   \ (hdfs)
28 / HiDrive
   \ (hidrive)
29 / Huawei Drive
   \ (huaweidrive)
30 / ImageKit.io
   \ (imagekit)
31 / In memory object storage system.
   \ (memory)
32 / Internet Archive
   \ (internetarchive)
33 / Internxt Drive
   \ (internxt)
34 / Jottacloud
   \ (jottacloud)
35 / Koofr, Digi Storage and other Koofr-compatible storage providers
   \ (koofr)
36 / Linkbox
   \ (linkbox)
37 / Local Disk
   \ (local)
38 / Mail.ru Cloud
   \ (mailru)
39 / Mega
   \ (mega)
40 / Microsoft Azure Blob Storage
   \ (azureblob)
41 / Microsoft Azure Files
   \ (azurefiles)
42 / Microsoft OneDrive
   \ (onedrive)
43 / OpenDrive
   \ (opendrive)
44 / OpenStack Swift (Rackspace Cloud Files, Blomp Cloud Storage, Memset Memstore, OVH)
   \ (swift)
45 / Oracle Cloud Infrastructure Object Storage
   \ (oracleobjectstorage)
46 / Pcloud
   \ (pcloud)
47 / PikPak
   \ (pikpak)
48 / Pixeldrain Filesystem
   \ (pixeldrain)
49 / Proton Drive
   \ (protondrive)
50 / Put.io
   \ (putio)
51 / QingCloud Object Storage
   \ (qingstor)
52 / Quatrix by Maytech
   \ (quatrix)
53 / Read archives
   \ (archive)
54 / SMB / CIFS
   \ (smb)
55 / SSH/SFTP
   \ (sftp)
56 / Shade FS
   \ (shade)
57 / Sia Decentralized Cloud
   \ (sia)
58 / Storj Decentralized Cloud Storage
   \ (storj)
59 / Sugarsync
   \ (sugarsync)
60 / Transparently chunk/split large files
   \ (chunker)
61 / Uloz.to
   \ (ulozto)
62 / Union merges the contents of several upstream fs
   \ (union)
63 / WebDAV
   \ (webdav)
64 / Yandex Disk
   \ (yandex)
65 / Zoho
   \ (zoho)
66 / iCloud Drive and Photos
   \ (iclouddrive)
67 / premiumize.me
   \ (premiumizeme)
68 / seafile
   \ (seafile)
Storage> 24

Option client_id.
Google Application Client Id
Setting your own is recommended.
See https://rclone.org/drive/#making-your-own-client-id for how to create your own.
If you leave this blank, it will use an internal key which is low performance.
Enter a value. Press Enter to leave empty.
client_id> **YOUR_CLIENT_ID.apps.googleusercontent.com**

Option client_secret.
OAuth Client Secret.
Leave blank normally.
Enter a value. Press Enter to leave empty.
client_secret> **YOUR_CLIENT_SECRET**

Option scope.
Comma separated list of scopes that rclone should use when requesting access from drive.
Choose a number from below, or type in your own value.
Press Enter to leave empty.
 1 / Full access all files, excluding Application Data Folder.
   \ (drive)
 2 / Read-only access to file metadata and file contents.
   \ (drive.readonly)
   / Access to files created by rclone only.
 3 | These are visible in the drive website.
   | File authorization is revoked when the user deauthorizes the app.
   \ (drive.file)
   / Allows read and write access to the Application Data folder.
 4 | This is not visible in the drive website.
   \ (drive.appfolder)
   / Allows read-only access to file metadata but
 5 | does not allow any access to read or download file content.
   \ (drive.metadata.readonly)
scope> 1

Option service_account_file.
Service Account Credentials JSON file path.
Leave blank normally.
Needed only if you want use SA instead of interactive login.
Leading `~` will be expanded in the file name as will environment variables such as `${RCLONE_CONFIG_DIR}`.
Enter a value. Press Enter to leave empty.
service_account_file> 

Edit advanced config?
y) Yes
n) No (default)
y/n> n

Use web browser to automatically authenticate rclone with remote?
 * Say Y if the machine running rclone has a web browser you can use
 * Say N if running rclone on a (remote) machine without web browser access
If not sure try Y. If Y failed, try N.

y) Yes (default)
n) No
y/n> y

2026/07/05 03:58:09 NOTICE: Make sure your Redirect URL is set to "http://127.0.0.1:53682/" in your custom config.
2026/07/05 03:58:09 NOTICE: If your browser doesn't open automatically go to the following link: http://127.0.0.1:53682/auth?state=j5GRZxvLTapiNs1Jr1xs9w
2026/07/05 03:58:09 NOTICE: Log in and authorize rclone for access
2026/07/05 03:58:09 NOTICE: Waiting for code...
Error: config failed to refresh token: Error: Auth Error
Code: ""
Description: No code returned by remote server
Help: 
Usage:
  rclone config [flags]
  rclone config [command]

Available commands:
  create      Create a new remote with name, type and options.
  delete      Delete an existing remote.
  disconnect  Disconnects user from remote
  dump        Dump the config file as JSON.
  edit        Enter an interactive configuration session.
  encryption  set, remove and check the encryption for the config file
  file        Show path of configuration file in use.
  password    Update password in an existing remote.
  paths       Show paths used for configuration, cache, temp etc.
  providers   List in JSON format all the providers and options.
  reconnect   Re-authenticates user with remote.
  redacted    Print redacted (decrypted) config file, or the redacted config for a single remote.
  show        Print (decrypted) config file, or the config for a single remote.
  string      Print connection string for a single remote.
  touch       Ensure configuration file exists.
  update      Update options in an existing remote.
  userinfo    Prints info about logged in user of remote.

