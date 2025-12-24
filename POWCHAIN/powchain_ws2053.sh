=================== META ====================

$ date
Wed Dec 24 07:12:04 UTC 2025

$ hostnamectl
 Static hostname: srv1195584
       Icon name: computer-vm
         Chassis: vm 🖴
      Machine ID: 294be129c49943b2a71927b207c3774a
         Boot ID: 4269d3c0330343349c66845a3e22c37c
  Virtualization: kvm
Operating System: Ubuntu 24.04.3 LTS
          Kernel: Linux 6.8.0-90-generic
    Architecture: x86-64
 Hardware Vendor: QEMU
  Hardware Model: Standard PC _i440FX + PIIX, 1996_
Firmware Version: rel-1.17.0-0-gb52ca86e094d-prebuilt.qemu.org
   Firmware Date: Tue 2014-04-01
    Firmware Age: 11y 8month 3w 3d

$ uname -a
Linux srv1195584 6.8.0-90-generic #91-Ubuntu SMP PREEMPT_DYNAMIC Tue Nov 18 14:14:30 UTC 2025 x86_64 x86_64 x86_64 GNU/Linux

$ whoami
root

$ id
uid=0(root) gid=0(root) groups=0(root)

$ uptime
 07:12:04 up 5 days, 15:37,  2 users,  load average: 0.03, 0.03, 0.00

$ timedatectl
               Local time: Wed 2025-12-24 07:12:04 UTC
           Universal time: Wed 2025-12-24 07:12:04 UTC
                 RTC time: Wed 2025-12-24 07:12:04
                Time zone: Etc/UTC (UTC, +0000)
System clock synchronized: yes
              NTP service: active
          RTC in local TZ: no

$ last -x
root     pts/0        169.254.0.1      Wed Dec 24 07:11   still logged in
root     pts/0        169.254.0.1      Wed Dec 24 07:07 - 07:11  (00:04)
root     pts/0        169.254.0.1      Wed Dec 24 03:56 - 05:13  (01:17)
root     pts/0        169.254.0.1      Wed Dec 24 03:52 - 03:56  (00:03)
root     pts/0        169.254.0.1      Tue Dec 23 20:49 - 23:09  (02:20)
root     pts/0        169.254.0.1      Tue Dec 23 20:44 - 20:49  (00:04)
root     pts/0        169.254.0.1      Tue Dec 23 20:30 - 20:44  (00:13)
root     pts/1        169.254.0.1      Tue Dec 23 19:42 - 19:45  (00:03)
root     pts/0        169.254.0.1      Tue Dec 23 19:10 - 20:28  (01:18)
root     pts/0        169.254.0.1      Tue Dec 23 18:55 - 19:10  (00:14)
root     pts/0        169.254.0.1      Tue Dec 23 17:53 - 18:02  (00:09)
root     pts/0        169.254.0.1      Tue Dec 23 14:13 - 15:43  (01:30)
root     pts/0        169.254.0.1      Tue Dec 23 14:07 - 14:13  (00:05)
root     pts/0        169.254.0.1      Tue Dec 23 14:05 - 14:07  (00:02)
root     pts/0        169.254.0.1      Tue Dec 23 14:02 - 14:04  (00:02)
root     pts/0        169.254.0.1      Tue Dec 23 13:59 - 14:02  (00:02)
root     pts/0        169.254.0.1      Tue Dec 23 13:53 - 13:57  (00:04)
root     pts/0        169.254.0.1      Tue Dec 23 13:50 - 13:53  (00:02)

==================== OS / PACKAGES ====================

$ bash -lc cat /etc/os-release 2>/dev/null || true
PRETTY_NAME="Ubuntu 24.04.3 LTS"
NAME="Ubuntu"
VERSION_ID="24.04"
VERSION="24.04.3 LTS (Noble Numbat)"
VERSION_CODENAME=noble
ID=ubuntu
ID_LIKE=debian
HOME_URL="https://www.ubuntu.com/"
SUPPORT_URL="https://help.ubuntu.com/"
BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"
PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy"
UBUNTU_CODENAME=noble
LOGO=ubuntu-logo

$ dpkg -l
Desired=Unknown/Install/Remove/Purge/Hold
ii  certbot                           2.9.0-1                                 all          automatically configure HTTPS using Let's Encrypt
ii  fail2ban                          1.0.2-3ubuntu0.1                        all          ban hosts that cause multiple authentication errors
ii  fonts-ubuntu-console              0.869+git20240321-0ubuntu1              all          console version of the Ubuntu Mono font
ii  git                               1:2.43.0-1ubuntu7.3                     amd64        fast, scalable, distributed revision control system
ii  git-man                           1:2.43.0-1ubuntu7.3                     all          fast, scalable, distributed revision control system (manual pages)
ii  libgpm2:amd64                     1.20.7-11                               amd64        General Purpose Mouse - shared library
ii  libpfm4:amd64                     4.13.0+git32-g0d4ed0e-1                 amd64        Library to program the performance monitoring events
ii  libpython3-stdlib:amd64           3.12.3-0ubuntu2.1                       amd64        interactive high-level object-oriented language (default python3 version)
ii  libpython3.12-minimal:amd64       3.12.3-1ubuntu0.9                       amd64        Minimal subset of the Python language (version 3.12)
ii  libpython3.12-stdlib:amd64        3.12.3-1ubuntu0.9                       amd64        Interactive high-level object-oriented language (standard library, version 3.12)
ii  libpython3.12t64:amd64            3.12.3-1ubuntu0.9                       amd64        Shared Python runtime library (version 3.12)
ii  librtmp1:amd64                    2.4+20151223.gitfa8646d.1-2build7       amd64        toolkit for RTMP streams (shared library)
ii  libtiff6:amd64                    4.5.1+git230720-4ubuntu2.4              amd64        Tag Image File Format (TIFF) library
ii  libwebp7:amd64                    1.3.2-0.4build3                         amd64        Lossy compression of digital photographic images
ii  libwebpdemux2:amd64               1.3.2-0.4build3                         amd64        Lossy compression of digital photographic images.
ii  libwebpmux3:amd64                 1.3.2-0.4build3                         amd64        Lossy compression of digital photographic images
ii  lshw                              02.19.git.2021.06.19.996aaad9c7-2build3 amd64        information about hardware configuration
ii  nginx                             1.24.0-2ubuntu7.5                       amd64        small, powerful, scalable web/proxy server
ii  nginx-common                      1.24.0-2ubuntu7.5                       all          small, powerful, scalable web/proxy server - common files
ii  nodejs                            20.19.6-1nodesource1                    amd64        Node.js event-based server-side javascript engine
ii  python3                           3.12.3-0ubuntu2.1                       amd64        interactive high-level object-oriented language (default python3 version)
ii  python3-acme                      2.9.0-1                                 all          ACME protocol library for Python 3
ii  python3-apport                    2.28.1-0ubuntu3.8                       all          Python 3 library for Apport crash report handling
ii  python3-apt                       2.7.7ubuntu5.1                          amd64        Python 3 interface to libapt-pkg
ii  python3-attr                      23.2.0-2                                all          Attributes without boilerplate (Python 3)
ii  python3-automat                   22.10.0-2                               all          Self-service finite-state machines for the programmer on the go
ii  python3-babel                     2.10.3-3build1                          all          tools for internationalizing Python applications - Python 3.x
ii  python3-bcrypt                    3.2.2-1build1                           amd64        password hashing library for Python 3
ii  python3-blinker                   1.7.0-1                                 all          Fast, simple object-to-object and broadcast signaling (Python3)
ii  python3-boto3                     1.34.46+dfsg-1ubuntu1                   all          Python interface to Amazon's Web Services - Python 3.x
ii  python3-botocore                  1.34.46+repack-1ubuntu1                 all          Low-level, data-driven core of boto 3 (Python 3)
ii  python3-bpfcc                     0.29.1+ds-1ubuntu7                      all          Python 3 wrappers for BPF Compiler Collection (BCC)
ii  python3-certbot                   2.9.0-1                                 all          main library for certbot
ii  python3-certbot-nginx             2.9.0-1                                 all          Nginx plugin for Certbot
ii  python3-certifi                   2023.11.17-1                            all          root certificates for validating SSL certs and verifying TLS hosts (python3)
ii  python3-cffi-backend:amd64        1.16.0-2build1                          amd64        Foreign Function Interface for Python 3 calling C code - runtime
ii  python3-chardet                   5.2.0+dfsg-1                            all          Universal Character Encoding Detector (Python3)
ii  python3-click                     8.1.6-2                                 all          Wrapper around optparse for command line utilities - Python 3.x
ii  python3-colorama                  0.4.6-4                                 all          Cross-platform colored terminal text in Python - Python 3.x
ii  python3-commandnotfound           23.04.0                                 all          Python 3 bindings for command-not-found.
ii  python3-configargparse            1.7-1                                   all          replacement for argparse with config files and environment variables
ii  python3-configobj                 5.0.8-3                                 all          simple but powerful config file reader and writer for Python 3
ii  python3-constantly                23.10.4-1                               all          Symbolic constants in Python
ii  python3-cryptography              41.0.7-4ubuntu0.1                       amd64        Python library exposing cryptographic recipes and primitives (Python 3)
ii  python3-dateutil                  2.8.2-3ubuntu1                          all          powerful extensions to the standard Python 3 datetime module
ii  python3-dbus                      1.3.2-5build3                           amd64        simple interprocess messaging system (Python 3 interface)
ii  python3-debconf                   1.5.86ubuntu1                           all          interact with debconf from Python 3
ii  python3-debian                    0.1.49ubuntu2                           all          Python 3 modules to work with Debian-related data formats
ii  python3-distro                    1.9.0-1                                 all          Linux OS platform information API
ii  python3-distro-info               1.7build1                               all          information about distributions' releases (Python 3 module)
ii  python3-distupgrade               1:24.04.27                              all          manage release upgrades
ii  python3-gdbm:amd64                3.12.3-0ubuntu1                         amd64        GNU dbm database support for Python 3.x
ii  python3-gi                        3.48.2-1                                amd64        Python 3 bindings for gobject-introspection libraries
ii  python3-hamcrest                  2.1.0-1                                 all          Hamcrest framework for matcher objects (Python 3)
ii  python3-httplib2                  0.20.4-3                                all          comprehensive HTTP client library written for Python3
ii  python3-hyperlink                 21.0.0-5                                all          Immutable, Pythonic, correct URLs.
ii  python3-icu                       2.12-1build2                            amd64        Python 3 extension wrapping the ICU C++ API
ii  python3-idna                      3.6-2ubuntu0.1                          all          Python IDNA2008 (RFC 5891) handling (Python 3)
ii  python3-incremental               22.10.0-1                               all          Library for versioning Python projects
ii  python3-jinja2                    3.1.2-1ubuntu1.3                        all          small but fast and easy to use stand-alone template engine
ii  python3-jmespath                  1.0.1-1                                 all          JSON Matching Expressions (Python 3)
ii  python3-josepy                    1.14.0-1                                all          JOSE implementation for Python 3.x
ii  python3-json-pointer              2.0-0ubuntu1                            all          resolve JSON pointers - Python 3.x
ii  python3-jsonpatch                 1.32-3                                  all          library to apply JSON patches - Python 3.x
ii  python3-jsonschema                4.10.3-2ubuntu1                         all          An(other) implementation of JSON Schema (Draft 3, 4, 6, 7)
ii  python3-jwt                       2.7.0-1                                 all          Python 3 implementation of JSON Web Token
ii  python3-launchpadlib              1.11.0-6                                all          Launchpad web services client library (Python 3)
ii  python3-lazr.restfulclient        0.14.6-1                                all          client for lazr.restful-based web services (Python 3)
ii  python3-lazr.uri                  1.0.6-3                                 all          library for parsing, manipulating, and generating URIs
ii  python3-magic                     2:0.4.27-3                              all          python3 interface to the libmagic file type identification library
ii  python3-markdown-it               3.0.0-2                                 all          Python port of markdown-it and some its associated plugins
ii  python3-markupsafe                2.1.5-1build2                           amd64        HTML/XHTML/XML string library
ii  python3-mdurl                     0.1.2-1                                 all          Python port of the JavaScript mdurl package
ii  python3-minimal                   3.12.3-0ubuntu2.1                       amd64        minimal subset of the Python language (default python3 version)
ii  python3-netaddr                   0.8.0-2ubuntu1                          all          manipulation of various common network address notations (Python 3)
ii  python3-netifaces:amd64           0.11.0-2build3                          amd64        portable network interface information - Python 3.x
ii  python3-netplan                   1.1.2-8ubuntu1~24.04.1                  amd64        Declarative network configuration Python bindings
ii  python3-newt:amd64                0.52.24-2ubuntu2                        amd64        NEWT module for Python3
ii  python3-oauthlib                  3.2.2-1                                 all          generic, spec-compliant implementation of OAuth for Python3
ii  python3-openssl                   23.2.0-1                                all          Python 3 wrapper around the OpenSSL library
ii  python3-packaging                 24.0-1                                  all          core utilities for python3 packages
ii  python3-parsedatetime             2.6-3                                   all          Python 3 module to parse human-readable date/time expressions
ii  python3-pexpect                   4.9-2                                   all          Python 3 module for automating interactive applications
ii  python3-pkg-resources             68.1.2-2ubuntu1.2                       all          Package Discovery and Resource Access using pkg_resources
ii  python3-problem-report            2.28.1-0ubuntu3.8                       all          Python 3 library to handle problem reports
ii  python3-ptyprocess                0.7.0-5                                 all          Run a subprocess in a pseudo terminal from Python 3
ii  python3-pyasn1                    0.4.8-4                                 all          ASN.1 library for Python (Python 3 module)
ii  python3-pyasn1-modules            0.2.8-1                                 all          Collection of protocols modules written in ASN.1 language (Python 3)
ii  python3-pyasyncore                1.0.2-2                                 all          asyncore for Python 3.12 onwards
ii  python3-pygments                  2.17.2+dfsg-1                           all          syntax highlighting package written in Python 3
ii  python3-pyinotify                 0.9.6-2ubuntu1                          all          simple Linux inotify Python bindings
ii  python3-pyparsing                 3.1.1-1                                 all          alternative to creating and executing simple grammars - Python 3.x
ii  python3-pyrsistent:amd64          0.20.0-1build2                          amd64        persistent/functional/immutable data structures for Python
ii  python3-requests                  2.31.0+dfsg-1ubuntu1.1                  all          elegant and simple HTTP library for Python3, built for human beings
ii  python3-rfc3339                   1.1-4                                   all          parser and generator of RFC 3339-compliant timestamps (Python 3)
ii  python3-rich                      13.7.1-1                                all          render rich text, tables, progress bars, syntax highlighting, markdown and more
ii  python3-s3transfer                0.10.1-1ubuntu2                         all          Amazon S3 Transfer Manager for Python3
ii  python3-serial                    3.5-2                                   all          pyserial - module encapsulating access for the serial port
ii  python3-service-identity          24.1.0-1                                all          Service identity verification for pyOpenSSL (Python 3 module)
ii  python3-setuptools                68.1.2-2ubuntu1.2                       all          Python3 Distutils Enhancements
ii  python3-six                       1.16.0-4                                all          Python 2 and 3 compatibility library
ii  python3-software-properties       0.99.49.3                               all          manage the repositories that you install software from
ii  python3-systemd                   235-1build4                             amd64        Python 3 bindings for systemd
ii  python3-twisted                   24.3.0-1ubuntu0.1                       all          Event-based framework for internet applications
ii  python3-typing-extensions         4.10.0-1                                all          Backported and Experimental Type Hints for Python
ii  python3-tz                        2024.1-2                                all          Python3 version of the Olson timezone database
ii  python3-update-manager            1:24.04.12                              all          Python 3.x module for update-manager
ii  python3-urllib3                   2.0.7-1ubuntu0.3                        all          HTTP library with thread-safe connection pooling for Python3
ii  python3-wadllib                   1.3.6-5                                 all          Python 3 library for navigating WADL files
ii  python3-yaml                      6.0.1-2build2                           amd64        YAML parser and emitter for Python3
ii  python3-zope.interface            6.1-1build1                             amd64        Interfaces for Python3
ii  python3.12                        3.12.3-1ubuntu0.9                       amd64        Interactive high-level object-oriented language (version 3.12)
ii  python3.12-minimal                3.12.3-1ubuntu0.9                       amd64        Minimal subset of the Python language (version 3.12)
ii  ufw                               0.36.2-6                                all          program for managing a Netfilter firewall
ii  vite                              1.2+svn+git4.c6c0ce7-8build2            amd64        Efficient visual trace explorer
ii  wireguard                         1.0.20210914-1ubuntu4                   all          fast, modern, secure kernel VPN tunnel (metapackage)
ii  wireguard-tools                   1.0.20210914-1ubuntu4                   amd64        fast, modern, secure kernel VPN tunnel (userland utilities)

$ systemctl is-enabled unattended-upgrades
enabled

==================== USERS / SUDO / SSH (NO SECRETS) ====================

$ bash -lc cut -d: -f1,3,4,6,7 /etc/passwd | sort -t: -k2,2n | tail -n 80
root:0:0:/root:/bin/bash
daemon:1:1:/usr/sbin:/usr/sbin/nologin
bin:2:2:/bin:/usr/sbin/nologin
sys:3:3:/dev:/usr/sbin/nologin
sync:4:65534:/bin:/bin/sync
games:5:60:/usr/games:/usr/sbin/nologin
man:6:12:/var/cache/man:/usr/sbin/nologin
lp:7:7:/var/spool/lpd:/usr/sbin/nologin
mail:8:8:/var/mail:/usr/sbin/nologin
news:9:9:/var/spool/news:/usr/sbin/nologin
uucp:10:10:/var/spool/uucp:/usr/sbin/nologin
proxy:13:13:/bin:/usr/sbin/nologin
www-data:33:33:/var/www:/usr/sbin/nologin
backup:34:34:/var/backups:/usr/sbin/nologin
list:38:38:/var/list:/usr/sbin/nologin
irc:39:39:/run/ircd:/usr/sbin/nologin
_apt:42:65534:/nonexistent:/usr/sbin/nologin
dhcpcd:100:65534:/usr/lib/dhcpcd:/bin/false
messagebus:101:101:/nonexistent:/usr/sbin/nologin
syslog:102:102:/nonexistent:/usr/sbin/nologin
uuidd:103:103:/run/uuidd:/usr/sbin/nologin
tss:104:104:/var/lib/tpm:/bin/false
sshd:105:65534:/run/sshd:/usr/sbin/nologin
pollinate:106:1:/var/cache/pollinate:/bin/false
tcpdump:107:108:/nonexistent:/usr/sbin/nologin
landscape:108:109:/var/lib/landscape:/usr/sbin/nologin
blockchain:109:112:/opt/blockchain:/usr/sbin/nologin
debian-tor:110:113:/var/lib/tor:/bin/false
polkitd:989:989:/:/usr/sbin/nologin
fwupd-refresh:990:990:/var/lib/fwupd:/usr/sbin/nologin
systemd-resolve:991:991:/:/usr/sbin/nologin
systemd-timesync:996:996:/:/usr/sbin/nologin
systemd-network:998:998:/:/usr/sbin/nologin
fireinners:999:988:/home/fireinners:/usr/sbin/nologin
ubuntu:1000:1000:/home/ubuntu:/bin/bash
nobody:65534:65534:/nonexistent:/usr/sbin/nologin

$ bash -lc getent group sudo 2>/dev/null || true; getent group wheel 2>/dev/null || true
sudo:x:27:ubuntu

$ bash -lc grep -R "^[^#]*Port\|^[^#]*PermitRootLogin\|^[^#]*PasswordAuthentication\|^[^#]*PubkeyAuthentication\|^[^#]*AllowUsers\|^[^#]*AllowGroups" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/* 2>/dev/null || true
/etc/ssh/sshd_config:PermitRootLogin prohibit-password
/etc/ssh/sshd_config.d/50-cloud-init.conf:PasswordAuthentication yes
/etc/ssh/sshd_config.d/60-cloudimg-settings.conf:PasswordAuthentication no

==================== CPU / RAM / DISK ====================

$ bash -lc nproc; lscpu | sed -n "1,35p"
2
Architecture:                         x86_64
CPU op-mode(s):                       32-bit, 64-bit
Address sizes:                        52 bits physical, 57 bits virtual
Byte Order:                           Little Endian
CPU(s):                               2
On-line CPU(s) list:                  0,1
Vendor ID:                            AuthenticAMD
BIOS Vendor ID:                       QEMU
Model name:                           AMD EPYC 9354P 32-Core Processor
BIOS Model name:                      pc-i440fx-10.1  CPU @ 2.0GHz
BIOS CPU family:                      1
CPU family:                           25
Model:                                17
Thread(s) per core:                   1
Core(s) per socket:                   2
Socket(s):                            1
Stepping:                             1
BogoMIPS:                             6490.24
Flags:                                fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush mmx fxsr sse sse2 ht syscall nx mmxext fxsr_opt pdpe1gb rdtscp lm rep_good nopl cpuid extd_apicid tsc_known_freq pni pclmulqdq ssse3 fma cx16 pcid sse4_1 sse4_2 x2apic movbe popcnt tsc_deadline_timer aes xsave avx f16c rdrand hypervisor lahf_lm cmp_legacy svm cr8_legacy abm sse4a misalignsse 3dnowprefetch osvw perfctr_core ssbd perfmon_v2 ibrs ibpb stibp ibrs_enhanced vmmcall fsgsbase tsc_adjust bmi1 avx2 smep bmi2 erms invpcid avx512f avx512dq rdseed adx smap avx512ifma clflushopt clwb avx512cd sha_ni avx512bw avx512vl xsaveopt xsavec xgetbv1 xsaves avx512_bf16 clzero xsaveerptr wbnoinvd arat npt lbrv nrip_save tsc_scale vmcb_clean flushbyasid pausefilter pfthreshold v_vmsave_vmload vgif vnmi avx512vbmi umip pku ospke avx512_vbmi2 gfni vaes vpclmulqdq avx512_vnni avx512_bitalg avx512_vpopcntdq la57 rdpid overflow_recov succor fsrm flush_l1d
Virtualization:                       AMD-V
Hypervisor vendor:                    KVM
Virtualization type:                  full
L1d cache:                            128 KiB (2 instances)
L1i cache:                            128 KiB (2 instances)
L2 cache:                             1 MiB (2 instances)
L3 cache:                             32 MiB (2 instances)
NUMA node(s):                         1
NUMA node0 CPU(s):                    0,1
Vulnerability Gather data sampling:   Not affected
Vulnerability Itlb multihit:          Not affected
Vulnerability L1tf:                   Not affected
Vulnerability Mds:                    Not affected
Vulnerability Meltdown:               Not affected
Vulnerability Mmio stale data:        Not affected
Vulnerability Reg file data sampling: Not affected

$ free -h
               total        used        free      shared  buff/cache   available
Mem:           7.8Gi       866Mi       827Mi       1.1Mi       6.4Gi       6.9Gi
Swap:             0B          0B          0B

$ df -hT
Filesystem     Type   Size  Used Avail Use% Mounted on
tmpfs          tmpfs  795M  1.1M  794M   1% /run
/dev/sda1      ext4    96G   16G   80G  17% /
tmpfs          tmpfs  3.9G     0  3.9G   0% /dev/shm
tmpfs          tmpfs  5.0M     0  5.0M   0% /run/lock
/dev/sda16     ext4   881M  119M  701M  15% /boot
/dev/sda15     vfat   105M  6.2M   99M   6% /boot/efi
tmpfs          tmpfs  795M   12K  795M   1% /run/user/0

$ bash -lc du -sh /var/log /var/www /home /etc/nginx /etc/letsencrypt 2>/dev/null || true
179M    /var/log
2.7M    /var/www
36K     /home
196K    /etc/nginx
232K    /etc/letsencrypt

==================== NETWORK (LISTEN, ROUTES, DNS) ====================

$ ip -br a
lo               UNKNOWN        127.0.0.1/8 
eth0             UP             72.61.79.12/24 2a02:4780:2d:3f4::1/48 fe80::8e8:d4ff:feb7:4e40/64 
wg0              UNKNOWN        10.66.66.1/24 

$ ip route
default via 72.61.79.254 dev eth0 proto static 
10.66.66.0/24 dev wg0 proto kernel scope link src 10.66.66.1 
72.61.79.0/24 dev eth0 proto kernel scope link src 72.61.79.12 

$ bash -lc cat /etc/resolv.conf 2>/dev/null || true
nameserver 1.1.1.1
nameserver 8.8.8.8
options timeout:1 attempts:3

$ ss -tulpn
Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:PortProcess                                                                          
udp   UNCONN 0      0          127.0.0.1:1721       0.0.0.0:*    users:(("monarx-agent",pid=772,fd=8))                                           
udp   UNCONN 0      0            0.0.0.0:51820      0.0.0.0:*                                                                                    
udp   UNCONN 0      0          127.0.0.1:9053       0.0.0.0:*    users:(("tor",pid=26545,fd=7))                                                  
udp   UNCONN 0      0               [::]:51820         [::]:*                                                                                    
tcp   LISTEN 0      511        127.0.0.1:9696       0.0.0.0:*    users:(("node",pid=111721,fd=18))                                               
tcp   LISTEN 0      511          0.0.0.0:3000       0.0.0.0:*    users:(("node",pid=78474,fd=18))                                                
tcp   LISTEN 0      511        127.0.0.1:12701      0.0.0.0:*    users:(("node /opt/price",pid=22222,fd=20))                                     
tcp   LISTEN 0      511        127.0.0.1:12702      0.0.0.0:*    users:(("node",pid=83935,fd=18))                                                
tcp   LISTEN 0      4096       127.0.0.1:9050       0.0.0.0:*    users:(("tor",pid=26545,fd=6))                                                  
tcp   LISTEN 0      4096         0.0.0.0:22         0.0.0.0:*    users:(("sshd",pid=1003,fd=3),("systemd",pid=1,fd=98))                          
tcp   LISTEN 0      511          0.0.0.0:8484       0.0.0.0:*    users:(("node /root/qplu",pid=72937,fd=20))                                     
tcp   LISTEN 0      511          0.0.0.0:443        0.0.0.0:*    users:(("nginx",pid=65802,fd=5),("nginx",pid=65801,fd=5),("nginx",pid=810,fd=5))
tcp   LISTEN 0      4096       127.0.0.1:65529      0.0.0.0:*    users:(("monarx-agent",pid=772,fd=7))                                           
tcp   LISTEN 0      4096            [::]:22            [::]:*    users:(("sshd",pid=1003,fd=4),("systemd",pid=1,fd=99))                          

==================== FIREWALL ====================

$ ufw status verbose
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), deny (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
80                         ALLOW IN    Anywhere                  
443                        ALLOW IN    Anywhere                  
22/tcp                     LIMIT IN    Anywhere                  
80/tcp                     ALLOW IN    Anywhere                  
4001                       ALLOW IN    127.0.0.1                 
443/tcp                    ALLOW IN    Anywhere                  
Anywhere                   ALLOW IN    127.0.0.1                 
Anywhere on lo             ALLOW IN    Anywhere                  
4001                       DENY IN     Anywhere                  
51820/udp                  ALLOW IN    Anywhere                  
8484/tcp                   ALLOW IN    Anywhere                  
3000/tcp                   ALLOW IN    Anywhere                  
8585/tcp                   ALLOW IN    Anywhere                  
80 (v6)                    ALLOW IN    Anywhere (v6)             
443 (v6)                   ALLOW IN    Anywhere (v6)             
22/tcp (v6)                LIMIT IN    Anywhere (v6)             
80/tcp (v6)                ALLOW IN    Anywhere (v6)             
443/tcp (v6)               ALLOW IN    Anywhere (v6)             
Anywhere (v6) on lo        ALLOW IN    Anywhere (v6)             
4001 (v6)                  DENY IN     Anywhere (v6)             
51820/udp (v6)             ALLOW IN    Anywhere (v6)             
8484/tcp (v6)              ALLOW IN    Anywhere (v6)             
3000/tcp (v6)              ALLOW IN    Anywhere (v6)             
8585/tcp (v6)              ALLOW IN    Anywhere (v6)             


$ bash -lc nft list ruleset 2>/dev/null | sed -n "1,220p" || true
table ip filter {
        chain ufw-before-logging-input {
        }

        chain ufw-before-logging-output {
        }

        chain ufw-before-logging-forward {
        }

        chain ufw-before-input {
                iifname "lo" counter packets 306 bytes 32117 accept
                ct state related,established counter packets 51771 bytes 22371959 accept
                ct state invalid counter packets 7 bytes 280 jump ufw-logging-deny
                ct state invalid counter packets 7 bytes 280 drop
                ip protocol icmp icmp type destination-unreachable counter packets 0 bytes 0 accept
                ip protocol icmp icmp type time-exceeded counter packets 0 bytes 0 accept
                ip protocol icmp icmp type parameter-problem counter packets 0 bytes 0 accept
                ip protocol icmp icmp type echo-request counter packets 259 bytes 15018 accept
                udp sport 67 udp dport 68 counter packets 0 bytes 0 accept
                counter packets 5948 bytes 319771 jump ufw-not-local
                ip daddr 224.0.0.251 udp dport 5353 counter packets 0 bytes 0 accept
                ip daddr 239.255.255.250 udp dport 1900 counter packets 0 bytes 0 accept
                counter packets 5948 bytes 319771 jump ufw-user-input
        }

        chain ufw-before-output {
                oifname "lo" counter packets 306 bytes 32117 accept
                ct state related,established counter packets 59939 bytes 13694874 accept
                counter packets 461 bytes 33278 jump ufw-user-output
        }

        chain ufw-before-forward {
                ct state related,established counter packets 0 bytes 0 accept
                ip protocol icmp icmp type destination-unreachable counter packets 0 bytes 0 accept
                ip protocol icmp icmp type time-exceeded counter packets 0 bytes 0 accept
                ip protocol icmp icmp type parameter-problem counter packets 0 bytes 0 accept
                ip protocol icmp icmp type echo-request counter packets 0 bytes 0 accept
                counter packets 0 bytes 0 jump ufw-user-forward
        }

        chain ufw-after-input {
                udp dport 137 counter packets 3 bytes 234 jump ufw-skip-to-policy-input
                udp dport 138 counter packets 0 bytes 0 jump ufw-skip-to-policy-input
                tcp dport 139 counter packets 1 bytes 52 jump ufw-skip-to-policy-input
                tcp dport 445 counter packets 13 bytes 664 jump ufw-skip-to-policy-input
                udp dport 67 counter packets 0 bytes 0 jump ufw-skip-to-policy-input
                udp dport 68 counter packets 0 bytes 0 jump ufw-skip-to-policy-input
                fib daddr type broadcast counter packets 0 bytes 0 jump ufw-skip-to-policy-input
        }

        chain ufw-after-output {
        }

        chain ufw-after-forward {
        }

        chain ufw-after-logging-input {
                limit rate 3/minute burst 10 packets counter packets 3300 bytes 162645 log prefix "[UFW BLOCK] "
        }

        chain ufw-after-logging-output {
        }

        chain ufw-after-logging-forward {
                limit rate 3/minute burst 10 packets counter packets 0 bytes 0 log prefix "[UFW BLOCK] "
        }

        chain ufw-reject-input {
        }

        chain ufw-reject-output {
        }

        chain ufw-reject-forward {
        }

        chain ufw-track-input {
        }

        chain ufw-track-output {
                ip protocol tcp ct state new counter packets 26 bytes 1560 accept
                ip protocol udp ct state new counter packets 435 bytes 31718 accept
        }

        chain ufw-track-forward {
        }

        chain INPUT {
                type filter hook input priority filter; policy drop;
                counter packets 961096 bytes 600194622 jump ufw-before-logging-input
                counter packets 961096 bytes 600194622 jump ufw-before-input
                counter packets 25464 bytes 1547821 jump ufw-after-input
                counter packets 25373 bytes 1542865 jump ufw-after-logging-input
                counter packets 25373 bytes 1542865 jump ufw-reject-input
                counter packets 25373 bytes 1542865 jump ufw-track-input
        }

        chain OUTPUT {
                type filter hook output priority filter; policy accept;
                counter packets 919273 bytes 537061131 jump ufw-before-logging-output
                counter packets 919273 bytes 537061131 jump ufw-before-output
                counter packets 108458 bytes 6486647 jump ufw-after-output
                counter packets 108458 bytes 6486647 jump ufw-after-logging-output
                counter packets 108458 bytes 6486647 jump ufw-reject-output
                counter packets 108458 bytes 6486647 jump ufw-track-output
        }

        chain FORWARD {
                type filter hook forward priority filter; policy drop;
                counter packets 0 bytes 0 jump ufw-before-logging-forward
                counter packets 0 bytes 0 jump ufw-before-forward
                counter packets 0 bytes 0 jump ufw-after-forward
                counter packets 0 bytes 0 jump ufw-after-logging-forward
                counter packets 0 bytes 0 jump ufw-reject-forward
                counter packets 0 bytes 0 jump ufw-track-forward
                iifname "wg0" counter packets 0 bytes 0 accept
                oifname "wg0" counter packets 0 bytes 0 accept
                iifname "wg0" counter packets 0 bytes 0 accept
                oifname "wg0" counter packets 0 bytes 0 accept
        }

        chain ufw-logging-deny {
                ct state invalid limit rate 3/minute burst 10 packets counter packets 7 bytes 280 return
                limit rate 3/minute burst 10 packets counter packets 0 bytes 0 log prefix "[UFW BLOCK] "
        }

        chain ufw-logging-allow {
                limit rate 3/minute burst 10 packets counter packets 0 bytes 0 log prefix "[UFW ALLOW] "
        }

        chain ufw-skip-to-policy-input {
                counter packets 17 bytes 950 drop
        }

        chain ufw-skip-to-policy-output {
                counter packets 0 bytes 0 accept
        }

        chain ufw-skip-to-policy-forward {
                counter packets 0 bytes 0 drop
        }

        chain ufw-not-local {
                fib daddr type local counter packets 5948 bytes 319771 return
                fib daddr type multicast counter packets 0 bytes 0 return
                fib daddr type broadcast counter packets 0 bytes 0 return
                limit rate 3/minute burst 10 packets counter packets 0 bytes 0 jump ufw-logging-deny
                counter packets 0 bytes 0 drop
        }

        chain ufw-user-input {
                tcp dport 80 counter packets 900 bytes 54992 accept
                udp dport 80 counter packets 0 bytes 0 accept
                tcp dport 443 counter packets 247 bytes 14548 accept
                udp dport 443 counter packets 3 bytes 225 accept
                tcp dport 22 ct state new xt match "recent" counter packets 1138 bytes 67976
                tcp dport 22 ct state new xt match "recent" counter packets 254 bytes 15240 jump ufw-user-limit
                tcp dport 22 counter packets 884 bytes 52736 jump ufw-user-limit-accept
                tcp dport 80 counter packets 0 bytes 0 accept
                ip saddr 127.0.0.1 tcp dport 4001 counter packets 0 bytes 0 accept
                ip saddr 127.0.0.1 udp dport 4001 counter packets 0 bytes 0 accept
                tcp dport 443 counter packets 0 bytes 0 accept
                ip saddr 127.0.0.1 counter packets 0 bytes 0 accept
                iifname "lo" counter packets 0 bytes 0 accept
                tcp dport 4001 counter packets 0 bytes 0 drop
                udp dport 4001 counter packets 0 bytes 0 drop
                udp dport 51820 counter packets 0 bytes 0 accept
                tcp dport 8484 counter packets 8 bytes 512 accept
                tcp dport 3000 counter packets 79 bytes 4376 accept
                tcp dport 8585 counter packets 73 bytes 4068 accept
        }

        chain ufw-user-output {
        }

        chain ufw-user-forward {
        }

        chain ufw-user-logging-input {
        }

        chain ufw-user-logging-output {
        }

        chain ufw-user-logging-forward {
        }

        chain ufw-user-limit {
                limit rate 3/minute burst 5 packets counter packets 48 bytes 2880 log prefix "[UFW LIMIT BLOCK] "
                counter packets 254 bytes 15240 reject
        }

        chain ufw-user-limit-accept {
                counter packets 884 bytes 52736 accept
        }
}
table ip6 filter {
        chain ufw6-before-logging-input {
        }

        chain ufw6-before-logging-output {
        }

        chain ufw6-before-logging-forward {
        }

        chain ufw6-before-input {
                iifname "lo" counter packets 0 bytes 0 accept
                rt type 0 counter packets 0 bytes 0 drop
                ct state related,established counter packets 132349 bytes 267297928 accept
                meta l4proto ipv6-icmp icmpv6 type echo-reply counter packets 0 bytes 0 accept
                ct state invalid counter packets 0 bytes 0 jump ufw6-logging-deny
                ct state invalid counter packets 0 bytes 0 drop
                meta l4proto ipv6-icmp icmpv6 type destination-unreachable counter packets 0 bytes 0 accept
                meta l4proto ipv6-icmp icmpv6 type packet-too-big counter packets 0 bytes 0 accept
                meta l4proto ipv6-icmp icmpv6 type time-exceeded counter packets 0 bytes 0 accept
                meta l4proto ipv6-icmp icmpv6 type parameter-problem counter packets 0 bytes 0 accept
                meta l4proto ipv6-icmp icmpv6 type echo-request counter packets 1 bytes 50 accept
                meta l4proto ipv6-icmp icmpv6 type nd-router-solicit ip6 hoplimit 255 counter packets 0 bytes 0 accept

$ bash -lc iptables -S 2>/dev/null | sed -n "1,220p" || true
-P INPUT DROP
-P FORWARD DROP
-P OUTPUT ACCEPT
-N ufw-after-forward
-N ufw-after-input
-N ufw-after-logging-forward
-N ufw-after-logging-input
-N ufw-after-logging-output
-N ufw-after-output
-N ufw-before-forward
-N ufw-before-input
-N ufw-before-logging-forward
-N ufw-before-logging-input
-N ufw-before-logging-output
-N ufw-before-output
-N ufw-logging-allow
-N ufw-logging-deny
-N ufw-not-local
-N ufw-reject-forward
-N ufw-reject-input
-N ufw-reject-output
-N ufw-skip-to-policy-forward
-N ufw-skip-to-policy-input
-N ufw-skip-to-policy-output
-N ufw-track-forward
-N ufw-track-input
-N ufw-track-output
-N ufw-user-forward
-N ufw-user-input
-N ufw-user-limit
-N ufw-user-limit-accept
-N ufw-user-logging-forward
-N ufw-user-logging-input
-N ufw-user-logging-output
-N ufw-user-output
-A INPUT -j ufw-before-logging-input
-A INPUT -j ufw-before-input
-A INPUT -j ufw-after-input
-A INPUT -j ufw-after-logging-input
-A INPUT -j ufw-reject-input
-A INPUT -j ufw-track-input
-A FORWARD -j ufw-before-logging-forward
-A FORWARD -j ufw-before-forward
-A FORWARD -j ufw-after-forward
-A FORWARD -j ufw-after-logging-forward
-A FORWARD -j ufw-reject-forward
-A FORWARD -j ufw-track-forward
-A FORWARD -i wg0 -j ACCEPT
-A FORWARD -o wg0 -j ACCEPT
-A FORWARD -i wg0 -j ACCEPT
-A FORWARD -o wg0 -j ACCEPT
-A OUTPUT -j ufw-before-logging-output
-A OUTPUT -j ufw-before-output
-A OUTPUT -j ufw-after-output
-A OUTPUT -j ufw-after-logging-output
-A OUTPUT -j ufw-reject-output
-A OUTPUT -j ufw-track-output
-A ufw-after-input -p udp -m udp --dport 137 -j ufw-skip-to-policy-input
-A ufw-after-input -p udp -m udp --dport 138 -j ufw-skip-to-policy-input
-A ufw-after-input -p tcp -m tcp --dport 139 -j ufw-skip-to-policy-input
-A ufw-after-input -p tcp -m tcp --dport 445 -j ufw-skip-to-policy-input
-A ufw-after-input -p udp -m udp --dport 67 -j ufw-skip-to-policy-input
-A ufw-after-input -p udp -m udp --dport 68 -j ufw-skip-to-policy-input
-A ufw-after-input -m addrtype --dst-type BROADCAST -j ufw-skip-to-policy-input
-A ufw-after-logging-forward -m limit --limit 3/min --limit-burst 10 -j LOG --log-prefix "[UFW BLOCK] "
-A ufw-after-logging-input -m limit --limit 3/min --limit-burst 10 -j LOG --log-prefix "[UFW BLOCK] "
-A ufw-before-forward -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
-A ufw-before-forward -p icmp -m icmp --icmp-type 3 -j ACCEPT
-A ufw-before-forward -p icmp -m icmp --icmp-type 11 -j ACCEPT
-A ufw-before-forward -p icmp -m icmp --icmp-type 12 -j ACCEPT
-A ufw-before-forward -p icmp -m icmp --icmp-type 8 -j ACCEPT
-A ufw-before-forward -j ufw-user-forward
-A ufw-before-input -i lo -j ACCEPT
-A ufw-before-input -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
-A ufw-before-input -m conntrack --ctstate INVALID -j ufw-logging-deny
-A ufw-before-input -m conntrack --ctstate INVALID -j DROP
-A ufw-before-input -p icmp -m icmp --icmp-type 3 -j ACCEPT
-A ufw-before-input -p icmp -m icmp --icmp-type 11 -j ACCEPT
-A ufw-before-input -p icmp -m icmp --icmp-type 12 -j ACCEPT
-A ufw-before-input -p icmp -m icmp --icmp-type 8 -j ACCEPT
-A ufw-before-input -p udp -m udp --sport 67 --dport 68 -j ACCEPT
-A ufw-before-input -j ufw-not-local
-A ufw-before-input -d 224.0.0.251/32 -p udp -m udp --dport 5353 -j ACCEPT
-A ufw-before-input -d 239.255.255.250/32 -p udp -m udp --dport 1900 -j ACCEPT
-A ufw-before-input -j ufw-user-input
-A ufw-before-output -o lo -j ACCEPT
-A ufw-before-output -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
-A ufw-before-output -j ufw-user-output
-A ufw-logging-allow -m limit --limit 3/min --limit-burst 10 -j LOG --log-prefix "[UFW ALLOW] "
-A ufw-logging-deny -m conntrack --ctstate INVALID -m limit --limit 3/min --limit-burst 10 -j RETURN
-A ufw-logging-deny -m limit --limit 3/min --limit-burst 10 -j LOG --log-prefix "[UFW BLOCK] "
-A ufw-not-local -m addrtype --dst-type LOCAL -j RETURN
-A ufw-not-local -m addrtype --dst-type MULTICAST -j RETURN
-A ufw-not-local -m addrtype --dst-type BROADCAST -j RETURN
-A ufw-not-local -m limit --limit 3/min --limit-burst 10 -j ufw-logging-deny
-A ufw-not-local -j DROP
-A ufw-skip-to-policy-forward -j DROP
-A ufw-skip-to-policy-input -j DROP
-A ufw-skip-to-policy-output -j ACCEPT
-A ufw-track-output -p tcp -m conntrack --ctstate NEW -j ACCEPT
-A ufw-track-output -p udp -m conntrack --ctstate NEW -j ACCEPT
-A ufw-user-input -p tcp -m tcp --dport 80 -j ACCEPT
-A ufw-user-input -p udp -m udp --dport 80 -j ACCEPT
-A ufw-user-input -p tcp -m tcp --dport 443 -j ACCEPT
-A ufw-user-input -p udp -m udp --dport 443 -j ACCEPT
-A ufw-user-input -p tcp -m tcp --dport 22 -m conntrack --ctstate NEW -m recent --set --name DEFAULT --mask 255.255.255.255 --rsource
-A ufw-user-input -p tcp -m tcp --dport 22 -m conntrack --ctstate NEW -m recent --update --seconds 30 --hitcount 6 --name DEFAULT --mask 255.255.255.255 --rsource -j ufw-user-limit
-A ufw-user-input -p tcp -m tcp --dport 22 -j ufw-user-limit-accept
-A ufw-user-input -p tcp -m tcp --dport 80 -j ACCEPT
-A ufw-user-input -s 127.0.0.1/32 -p tcp -m tcp --dport 4001 -j ACCEPT
-A ufw-user-input -s 127.0.0.1/32 -p udp -m udp --dport 4001 -j ACCEPT
-A ufw-user-input -p tcp -m tcp --dport 443 -j ACCEPT
-A ufw-user-input -s 127.0.0.1/32 -j ACCEPT
-A ufw-user-input -i lo -j ACCEPT
-A ufw-user-input -p tcp -m tcp --dport 4001 -j DROP
-A ufw-user-input -p udp -m udp --dport 4001 -j DROP
-A ufw-user-input -p udp -m udp --dport 51820 -j ACCEPT
-A ufw-user-input -p tcp -m tcp --dport 8484 -j ACCEPT
-A ufw-user-input -p tcp -m tcp --dport 3000 -j ACCEPT
-A ufw-user-input -p tcp -m tcp --dport 8585 -j ACCEPT
-A ufw-user-limit -m limit --limit 3/min -j LOG --log-prefix "[UFW LIMIT BLOCK] "
-A ufw-user-limit -j REJECT --reject-with icmp-port-unreachable
-A ufw-user-limit-accept -j ACCEPT

==================== SYSTEMD (RUNNING SERVICES SNAPSHOT) ====================

$ systemctl --no-pager --type=service --state=running
  UNIT                          LOAD   ACTIVE SUB     DESCRIPTION
  amcq.service                  loaded active running AMCQ Multi-Agent AI
  cron.service                  loaded active running Regular background program processing daemon
  dbus.service                  loaded active running D-Bus System Message Bus
  fireinners-qplus-wasm.service loaded active running FIREINNERS Q+ WASM Engine
  fwupd.service                 loaded active running Firmware update daemon
  getty@tty1.service            loaded active running Getty on tty1
  ModemManager.service          loaded active running Modem Manager
  monarx-agent.service          loaded active running Monarx Agent - Security Scanner
  multipathd.service            loaded active running Device-Mapper Multipath Device Controller
  nginx.service                 loaded active running A high performance web server and a reverse proxy server
  polkit.service                loaded active running Authorization Manager
  qemu-guest-agent.service      loaded active running QEMU Guest Agent
  rsyslog.service               loaded active running System Logging Service
  security-sentinel.service     loaded active running Security Sentinel (read-only)
  serial-getty@ttyS0.service    loaded active running Serial Getty on ttyS0
  snapd.service                 loaded active running Snap Daemon
  ssh.service                   loaded active running OpenBSD Secure Shell server
  systemd-hostnamed.service     loaded active running Hostname Service
  systemd-journald.service      loaded active running Journal Service
  systemd-logind.service        loaded active running User Login Management
  systemd-networkd.service      loaded active running Network Configuration
  systemd-timedated.service     loaded active running Time & Date Service
  systemd-timesyncd.service     loaded active running Network Time Synchronization
  systemd-udevd.service         loaded active running Rule-based Manager for Device Events and Files
  tor@default.service           loaded active running Anonymizing overlay network for TCP
  udisks2.service               loaded active running Disk Manager
  unattended-upgrades.service   loaded active running Unattended Upgrades Shutdown
  user@0.service                loaded active running User Manager for UID 0

Legend: LOAD   → Reflects whether the unit definition was properly loaded.
        ACTIVE → The high-level unit activation state, i.e. generalization of SUB.
        SUB    → The low-level unit activation state, values depend on unit type.

28 loaded units listed.

==================== NGINX (CONFIG + VHOST MAP) ====================

$ nginx -t
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful

$ nginx -V
nginx version: nginx/1.24.0 (Ubuntu)
built with OpenSSL 3.0.13 30 Jan 2024
TLS SNI support enabled
configure arguments: --with-cc-opt='-g -O2 -fno-omit-frame-pointer -mno-omit-leaf-frame-pointer -ffile-prefix-map=/build/nginx-WLuzPu/nginx-1.24.0=. -flto=auto -ffat-lto-objects -fstack-protector-strong -fstack-clash-protection -Wformat -Werror=format-security -fcf-protection -fdebug-prefix-map=/build/nginx-WLuzPu/nginx-1.24.0=/usr/src/nginx-1.24.0-2ubuntu7.5 -fPIC -Wdate-time -D_FORTIFY_SOURCE=3' --with-ld-opt='-Wl,-Bsymbolic-functions -flto=auto -ffat-lto-objects -Wl,-z,relro -Wl,-z,now -fPIC' --prefix=/usr/share/nginx --conf-path=/etc/nginx/nginx.conf --http-log-path=/var/log/nginx/access.log --error-log-path=stderr --lock-path=/var/lock/nginx.lock --pid-path=/run/nginx.pid --modules-path=/usr/lib/nginx/modules --http-client-body-temp-path=/var/lib/nginx/body --http-fastcgi-temp-path=/var/lib/nginx/fastcgi --http-proxy-temp-path=/var/lib/nginx/proxy --http-scgi-temp-path=/var/lib/nginx/scgi --http-uwsgi-temp-path=/var/lib/nginx/uwsgi --with-compat --with-debug --with-pcre-jit --with-http_ssl_module --with-http_stub_status_module --with-http_realip_module --with-http_auth_request_module --with-http_v2_module --with-http_dav_module --with-http_slice_module --with-threads --with-http_addition_module --with-http_flv_module --with-http_gunzip_module --with-http_gzip_static_module --with-http_mp4_module --with-http_random_index_module --with-http_secure_link_module --with-http_sub_module --with-mail_ssl_module --with-stream_ssl_module --with-stream_ssl_preread_module --with-stream_realip_module --with-http_geoip_module=dynamic --with-http_image_filter_module=dynamic --with-http_perl_module=dynamic --with-http_xslt_module=dynamic --with-mail=dynamic --with-stream=dynamic --with-stream_geoip_module=dynamic

$ bash -lc ls -la /etc/nginx 2>/dev/null || true; ls -la /etc/nginx/sites-enabled 2>/dev/null || true
total 128
drwxr-xr-x   8 root root  4096 Dec 17 06:47 .
drwxr-xr-x 127 root root 12288 Dec 23 02:34 ..
drwxr-xr-x   2 root root  4096 Dec 17 02:14 conf.d
-rw-r--r--   1 root root  1125 Nov 30  2023 fastcgi.conf
-rw-r--r--   1 root root  1055 Nov 30  2023 fastcgi_params
-rw-r--r--   1 root root  2837 Nov 30  2023 koi-utf
-rw-r--r--   1 root root  2223 Nov 30  2023 koi-win
-rw-r--r--   1 root root  5465 Nov 30  2023 mime.types
drwxr-xr-x   2 root root  4096 Aug 22 12:45 modules-available
drwxr-xr-x   2 root root  4096 Aug 22 12:45 modules-enabled
-rw-r--r--   1 root root  1784 Dec 17 06:47 nginx.conf
-rw-r--r--   1 root root  1446 Dec 17 05:01 nginx.conf.BAK_FIREINNERS
-rw-r--r--   1 root root   180 Nov 30  2023 proxy_params
-rw-r--r--   1 root root   636 Nov 30  2023 scgi_params
drwxr-xr-x   2 root root  4096 Dec 18 15:27 sites-available
drwxr-xr-x   2 root root  4096 Dec 20 06:16 sites-enabled
drwxr-xr-x   2 root root  4096 Dec 19 01:23 snippets
-rw-r--r--   1 root root   664 Nov 30  2023 uwsgi_params
-rw-r--r--   1 root root  3071 Nov 30  2023 win-utf
total 12
drwxr-xr-x 2 root root 4096 Dec 20 06:16 .
drwxr-xr-x 8 root root 4096 Dec 17 06:47 ..
-rw-r--r-- 1 root root 1072 Dec 19 18:26 fireinners.online-ssl

$ bash -lc grep -R "^[[:space:]]*server_name\|^[[:space:]]*listen\|proxy_pass\|root\|ssl_certificate\|ssl_certificate_key\|location /ws\|upgrade\|connection" /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/nginx/nginx.conf 2>/dev/null | sed -n "1,260p" || true
/etc/nginx/sites-enabled/fireinners.online-ssl:    listen 443 ssl http2;
/etc/nginx/sites-enabled/fireinners.online-ssl:    server_name fireinners.online www.fireinners.online;
/etc/nginx/sites-enabled/fireinners.online-ssl:    ssl_certificate     /etc/letsencrypt/live/fireinners.online/fullchain.pem;
/etc/nginx/sites-enabled/fireinners.online-ssl:    ssl_certificate_key /etc/letsencrypt/live/fireinners.online/privkey.pem;
/etc/nginx/sites-enabled/fireinners.online-ssl:    root /opt/fireinners/frontend-react/app/dist;
/etc/nginx/sites-enabled/fireinners.online-ssl:    location /ws {
/etc/nginx/sites-enabled/fireinners.online-ssl:        proxy_pass http://127.0.0.1:4001;
/etc/nginx/sites-enabled/fireinners.online-ssl:        proxy_set_header Upgrade $http_upgrade;
/etc/nginx/sites-enabled/fireinners.online-ssl:        proxy_set_header Connection "upgrade";
/etc/nginx/nginx.conf:  worker_connections 768;

==================== TLS / CERTBOT (DATES ONLY) ====================

$ certbot certificates

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Found the following certs:
  Certificate Name: fireinners.online-0001
    Serial Number: 6be9ce679e99315153cc753086ee727e87f
    Key Type: ECDSA
    Domains: fireinners.online
    Expiry Date: 2026-03-17 02:26:55+00:00 (VALID: 82 days)
    Certificate Path: /etc/letsencrypt/live/fireinners.online-0001/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/fireinners.online-0001/privkey.pem
  Certificate Name: fireinners.online
    Serial Number: 5cb24b89c966b1bde52d0fae4f7838e2cbf
    Key Type: ECDSA
    Domains: fireinners.online www.fireinners.online
    Expiry Date: 2026-03-13 01:59:16+00:00 (VALID: 78 days)
    Certificate Path: /etc/letsencrypt/live/fireinners.online/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/fireinners.online/privkey.pem
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
bash: line 45: f: unbound variable
root@srv1195584:~# 
